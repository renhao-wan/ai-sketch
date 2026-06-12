/**
 * L1/L2 分层缓存协调器
 *
 * L1：内存缓存（MemoryCache），50 条目 / 1MB，LRU 淘汰
 * L2：SQLite 持久化缓存（response_cache 表），100MB 上限，7 天 TTL
 *
 * 额外特性：
 * - Inflight 请求去重（防止并发重复请求穿透到 LLM）
 * - 命中/未命中统计持久化到 meta 表
 * - TTL 可通过 meta 表动态配置
 */

import { MemoryCache } from '@/lib/cache/memory-cache';
import { getDb, requestSave } from './index';

// ── 接口定义 ──

interface CacheEntry {
  id: string;
  configName: string;
  model: string;
  response: string;
  createdAt: number;
  lastUsedAt: number;
  useCount: number;
}

interface CacheStats {
  entries: number;
  totalSizeBytes: number;
  hits: number;
  misses: number;
  hitRate: number;
  ttlDays: number;
}

// ── 辅助函数 ──

/** 将数据库行对象解析为 CacheEntry */
function rowToCacheEntry(row: Record<string, unknown>): CacheEntry {
  return {
    id: row.id as string,
    configName: row.config_name as string,
    model: row.model as string,
    response: row.response as string,
    createdAt: row.created_at as number,
    lastUsedAt: row.last_used_at as number,
    useCount: row.use_count as number,
  };
}

// ── 常量 ──

/** 默认 TTL（天） */
const DEFAULT_TTL_DAYS = 7;

/** L2 最大体积（字节）：100MB */
const MAX_SIZE_BYTES = 100 * 1024 * 1024;

/** 高水位阈值：触发淘汰 */
const SIZE_RATIO_HIGH = 0.9;

/** 低水位阈值：淘汰目标 */
const SIZE_RATIO_LOW = 0.8;

// ── CacheManager ──

class CacheManager {
  /** L1 内存缓存 */
  private readonly l1 = new MemoryCache<string>(50, 1024 * 1024);

  /** Inflight 请求去重映射 */
  private readonly inflight = new Map<string, Promise<string | null>>();

  /** 缓存命中次数 */
  private hits = 0;

  /** 缓存未命中次数 */
  private misses = 0;

  /** TTL 内存缓存（毫秒），避免每次 L2 查询都访问 DB */
  private ttlCacheMs: number | null = null;

  /** loadStats 是否已执行 */
  private statsLoaded = false;

  // ── 公开 API ──

  /**
   * 获取缓存（L1 → L2 查找）
   * 命中时更新统计和 L2 使用时间；L2 命中时回填 L1
   */
  async get(cacheKey: string): Promise<string | null> {
    // L1 查找
    const l1Value = this.l1.get(cacheKey);
    if (l1Value !== undefined) {
      this.hits++;
      return l1Value;
    }

    // L2 查找
    const db = await getDb();
    const stmt = db.prepare('SELECT id, response, created_at FROM response_cache WHERE id = ?');
    stmt.bind([cacheKey]);

    let entry: CacheEntry | null = null;
    if (stmt.step()) {
      entry = rowToCacheEntry(stmt.getAsObject() as Record<string, unknown>);
    }
    stmt.free();

    if (!entry) {
      this.misses++;
      return null;
    }

    // 检查是否过期
    const now = Date.now();
    const ttlMs = (await this.getTtl()) * 24 * 60 * 60 * 1000;
    if (now - entry.createdAt > ttlMs) {
      db.run('DELETE FROM response_cache WHERE id = ?', [cacheKey]);
      requestSave();
      this.misses++;
      return null;
    }

    // 更新 L2 使用时间和次数
    db.run(
      'UPDATE response_cache SET last_used_at = ?, use_count = use_count + 1 WHERE id = ?',
      [now, cacheKey],
    );
    requestSave();

    // 回填 L1
    this.l1.set(cacheKey, entry.response);

    this.hits++;
    return entry.response;
  }

  /**
   * 写入缓存（同时写入 L1 和 L2）
   * 如果已存在则更新，否则插入
   */
  async set(
    cacheKey: string,
    response: string,
    metadata: { configName: string; model: string },
  ): Promise<void> {
    // 写入 L1（附带 metadata 以便按配置精确清除）
    this.l1.set(cacheKey, response, { configName: metadata.configName, model: metadata.model });

    // 写入 L2
    const db = await getDb();
    const now = Date.now();

    // 检查是否已存在
    const checkStmt = db.prepare('SELECT id FROM response_cache WHERE id = ?');
    checkStmt.bind([cacheKey]);
    const exists = checkStmt.step();
    checkStmt.free();

    if (exists) {
      db.run(
        'UPDATE response_cache SET response = ?, config_name = ?, model = ?, last_used_at = ?, use_count = use_count + 1 WHERE id = ?',
        [response, metadata.configName, metadata.model, now, cacheKey],
      );
    } else {
      db.run(
        'INSERT INTO response_cache (id, config_name, model, response, created_at, last_used_at, use_count) VALUES (?, ?, ?, ?, ?, ?, 1)',
        [cacheKey, metadata.configName, metadata.model, response, now, now],
      );
    }

    // 清理过期和超限条目（内部会 requestSave）
    await this.cleanup();
  }

  /**
   * 获取缓存或执行 fetcher（Inflight 去重）
   * 多个并发请求同一个 cacheKey 时，只执行一次 fetcher
   */
  async getOrFetch(
    cacheKey: string,
    fetcher: () => Promise<string | null>,
    metadata: { configName: string; model: string },
  ): Promise<string | null> {
    // 检查是否有进行中的请求
    const existing = this.inflight.get(cacheKey);
    if (existing) {
      return existing;
    }

    // 创建新请求
    const promise = (async () => {
      try {
        // 先查缓存
        const cached = await this.get(cacheKey);
        if (cached !== null) {
          return cached;
        }

        // 缓存未命中，执行 fetcher
        const result = await fetcher();
        if (result !== null) {
          await this.set(cacheKey, result, metadata);
        }
        return result;
      } finally {
        this.inflight.delete(cacheKey);
      }
    })();

    this.inflight.set(cacheKey, promise);
    return promise;
  }

  /** 清空所有缓存（L1 + L2） */
  async clearAll(): Promise<void> {
    this.l1.clear();
    const db = await getDb();
    db.run('DELETE FROM response_cache');
    requestSave();
  }

  /**
   * 按配置清除缓存
   * @returns 删除的条目数
   */
  async clearByConfig(configName: string, model: string): Promise<number> {
    const db = await getDb();
    db.run('DELETE FROM response_cache WHERE config_name = ? AND model = ?', [configName, model]);
    const result = db.exec('SELECT changes() as count');
    const l2Count = result.length > 0 ? (result[0].values[0][0] as number) : 0;

    // L1 按 metadata 精确清除
    const l1Count = this.l1.deleteIf(
      (meta) => meta.configName === configName && meta.model === model,
    );

    console.log(`[Cache] 按配置清除缓存: ${configName}/${model}, L1: ${l1Count}, L2: ${l2Count}`);

    requestSave();
    return l2Count;
  }

  /**
   * 清除过期条目
   * @returns 删除的条目数
   */
  async clearExpired(): Promise<number> {
    const db = await getDb();
    const now = Date.now();
    const ttlDays = await this.getTtl();
    const ttlMs = ttlDays * 24 * 60 * 60 * 1000;

    db.run('DELETE FROM response_cache WHERE created_at < ?', [now - ttlMs]);
    const result = db.exec('SELECT changes() as count');
    const count = result.length > 0 ? (result[0].values[0][0] as number) : 0;

    // 清除 L1 避免命中原已过期的条目
    this.l1.clear();

    requestSave();
    return count;
  }

  /** 获取缓存统计信息（首次调用时自动从 DB 加载历史统计） */
  async getStats(): Promise<CacheStats> {
    if (!this.statsLoaded) {
      await this.loadStats();
      this.statsLoaded = true;
    }

    const db = await getDb();

    const stmt = db.prepare(
      'SELECT COUNT(*) as entries, COALESCE(SUM(LENGTH(CAST(response AS BLOB))), 0) as total_size FROM response_cache',
    );
    let entries = 0;
    let totalSizeBytes = 0;
    if (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, unknown>;
      entries = row.entries as number;
      totalSizeBytes = row.total_size as number;
    }
    stmt.free();

    const total = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;
    const ttlDays = await this.getTtl();

    return { entries, totalSizeBytes, hits: this.hits, misses: this.misses, hitRate, ttlDays };
  }

  /** 获取缓存 TTL（天），优先使用内存缓存 */
  async getTtl(): Promise<number> {
    if (this.ttlCacheMs !== null) {
      return this.ttlCacheMs / (24 * 60 * 60 * 1000);
    }
    const db = await getDb();
    const stmt = db.prepare("SELECT value FROM meta WHERE key = 'cache_ttl_days'");
    let ttlDays = DEFAULT_TTL_DAYS;
    if (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, unknown>;
      ttlDays = parseInt(row.value as string, 10) || DEFAULT_TTL_DAYS;
    }
    stmt.free();
    this.ttlCacheMs = ttlDays * 24 * 60 * 60 * 1000;
    return ttlDays;
  }

  /** 设置缓存 TTL（天），同步更新内存缓存 */
  async setTtl(days: number): Promise<void> {
    const db = await getDb();
    db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('cache_ttl_days', ?)", [String(days)]);
    this.ttlCacheMs = days * 24 * 60 * 60 * 1000;
    requestSave();
  }

  /** 从 meta 表加载历史命中/未命中统计 */
  async loadStats(): Promise<void> {
    const db = await getDb();

    const hitsStmt = db.prepare("SELECT value FROM meta WHERE key = 'cache_hits'");
    if (hitsStmt.step()) {
      this.hits = parseInt((hitsStmt.getAsObject() as Record<string, unknown>).value as string, 10) || 0;
    }
    hitsStmt.free();

    const missesStmt = db.prepare("SELECT value FROM meta WHERE key = 'cache_misses'");
    if (missesStmt.step()) {
      this.misses = parseInt((missesStmt.getAsObject() as Record<string, unknown>).value as string, 10) || 0;
    }
    missesStmt.free();
  }

  // ── 内部方法 ──

  /**
   * 清理逻辑：
   * 1. 删除过期条目
   * 2. 检查总体积，超过 90% 高水位时按 LRU 淘汰至 80% 以下
   * 3. 持久化命中/未命中统计到 meta 表
   */
  private async cleanup(): Promise<void> {
    const db = await getDb();
    const now = Date.now();
    const ttlDays = await this.getTtl();
    const ttlMs = ttlDays * 24 * 60 * 60 * 1000;

    // 1. 删除过期条目
    db.run('DELETE FROM response_cache WHERE created_at < ?', [now - ttlMs]);

    // 2. 检查总体积
    const sizeStmt = db.prepare('SELECT COALESCE(SUM(LENGTH(CAST(response AS BLOB))), 0) as total_size FROM response_cache');
    let totalSize = 0;
    if (sizeStmt.step()) {
      totalSize = (sizeStmt.getAsObject() as Record<string, unknown>).total_size as number;
    }
    sizeStmt.free();

    // 超过高水位时，按 last_used_at 升序批量淘汰至低水位以下
    const highThreshold = MAX_SIZE_BYTES * SIZE_RATIO_HIGH;
    const lowThreshold = MAX_SIZE_BYTES * SIZE_RATIO_LOW;

    if (totalSize > highThreshold) {
      while (totalSize > lowThreshold) {
        // 查询本批最旧条目的体积
        const batchStmt = db.prepare(
          'SELECT COALESCE(SUM(LENGTH(CAST(response AS BLOB))), 0) as batch_size FROM (SELECT response FROM response_cache ORDER BY last_used_at ASC LIMIT 10)',
        );
        let batchSize = 0;
        if (batchStmt.step()) {
          batchSize = (batchStmt.getAsObject() as Record<string, unknown>).batch_size as number;
        }
        batchStmt.free();

        if (batchSize === 0) break;

        db.run(`
          DELETE FROM response_cache WHERE id IN (
            SELECT id FROM response_cache ORDER BY last_used_at ASC LIMIT 10
          )
        `);
        totalSize -= batchSize;
      }
    }

    // 3. 持久化统计
    db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('cache_hits', ?)", [String(this.hits)]);
    db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('cache_misses', ?)", [String(this.misses)]);

    requestSave();
  }
}

/**
 * 全局缓存管理器单例
 *
 * 注意：loadStats() 会在应用启动时由统计 API 端点自动调用，
 * 无需手动调用；getStats() 内部也会做懒加载保障。
 */
export const cacheManager = new CacheManager();
export default CacheManager;

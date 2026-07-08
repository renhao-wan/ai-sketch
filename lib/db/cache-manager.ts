/**
 * L1/L2 分层缓存协调器（三键存储版）
 *
 * L1：内存缓存（MemoryCache），50 条目 / 1MB，LRU 淘汰
 * L2：SQLite 持久化缓存（response_cache 表），100MB 上限，7 天 TTL
 *
 * 三键存储：
 * - 严格键（id）：6 因素完整匹配
 * - 中等键（mid_key）：4 因素匹配
 * - 宽松键（loose_key）：2 因素匹配
 *
 * 额外特性：
 * - Inflight 请求去重（防止并发重复请求穿透到 LLM）
 * - 命中/未命中统计持久化到 meta 表
 * - TTL 和档位可通过 meta 表动态配置
 */

import { MemoryCache } from '@/lib/cache/memory-cache';
import type { CacheLevel } from '@/lib/cache/cache-key';
import { getDb, requestSave } from './index';

// ── 接口定义 ──

interface CacheEntry {
  id: string;
  midKey: string;
  looseKey: string;
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
  level: CacheLevel;
}

// ── 辅助函数 ──

/** 将数据库行对象解析为 CacheEntry */
function rowToCacheEntry(row: Record<string, unknown>): CacheEntry {
  return {
    id: row.id as string,
    midKey: row.mid_key as string,
    looseKey: row.loose_key as string,
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

/** 默认档位 */
const DEFAULT_LEVEL: CacheLevel = 'normal';

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

  /** 档位内存缓存 */
  private levelCache: CacheLevel | null = null;

  /** loadStats 是否已执行 */
  private statsLoaded = false;

  /** loadStats Promise 缓存，避免竞态条件 */
  private loadStatsPromise: Promise<void> | null = null;

  /** 自上次持久化以来的 get() 调用次数，用于定期持久化 */
  private opsSinceLastPersist = 0;

  /** 持久化间隔（每 N 次 get() 操作持久化一次） */
  private readonly PERSIST_INTERVAL = 3;

  // ── 公开 API ──

  /**
   * 获取缓存（L1 → L2 查找）
   * 命中时更新统计和 L2 使用时间；L2 命中时回填 L1
   * @param keys 三档缓存键
   * @param level 当前档位
   */
  async get(keys: { strict: string; normal: string; loose: string }, level: CacheLevel): Promise<string | null> {
    // 确保历史统计已加载（首次调用时从 DB 加载）
    if (!this.statsLoaded) {
      await this.ensureStatsLoaded();
    }

    // 根据档位选择查找键
    const lookupKey = this.getKeyByLevel(keys, level);

    // L1 查找
    const l1Value = this.l1.get(lookupKey);
    if (l1Value !== undefined) {
      this.hits++;
      this.maybePersistStats();
      return l1Value;
    }

    // L2 查找
    const db = await getDb();
    let entry: CacheEntry | null = null;

    if (level === 'strict') {
      // 严格模式：精确匹配 id
      const stmt = db.prepare('SELECT * FROM response_cache WHERE id = ?');
      stmt.bind([lookupKey]);
      if (stmt.step()) {
        entry = rowToCacheEntry(stmt.getAsObject() as Record<string, unknown>);
      }
      stmt.free();
    } else if (level === 'normal') {
      // 中等模式：精确匹配 mid_key
      const stmt = db.prepare('SELECT * FROM response_cache WHERE mid_key = ? ORDER BY last_used_at DESC LIMIT 1');
      stmt.bind([lookupKey]);
      if (stmt.step()) {
        entry = rowToCacheEntry(stmt.getAsObject() as Record<string, unknown>);
      }
      stmt.free();
    } else {
      // 宽松模式：精确匹配 loose_key
      const stmt = db.prepare('SELECT * FROM response_cache WHERE loose_key = ? ORDER BY last_used_at DESC LIMIT 1');
      stmt.bind([lookupKey]);
      if (stmt.step()) {
        entry = rowToCacheEntry(stmt.getAsObject() as Record<string, unknown>);
      }
      stmt.free();
    }

    if (!entry) {
      this.misses++;
      this.maybePersistStats();
      return null;
    }

    // 检查是否过期
    const now = Date.now();
    const ttlMs = (await this.getTtl()) * 24 * 60 * 60 * 1000;
    if (now - entry.createdAt > ttlMs) {
      db.run('DELETE FROM response_cache WHERE id = ?', [entry.id]);
      requestSave();
      this.misses++;
      this.maybePersistStats();
      return null;
    }

    // 更新 L2 使用时间和次数
    db.run(
      'UPDATE response_cache SET last_used_at = ?, use_count = use_count + 1 WHERE id = ?',
      [now, entry.id],
    );
    requestSave();

    // 回填 L1（使用查找键）
    this.l1.set(lookupKey, entry.response);

    this.hits++;
    this.maybePersistStats();
    return entry.response;
  }

  /**
   * 写入缓存（同时写入 L1 和 L2）
   * 如果已存在则更新，否则插入
   * @param keys 三档缓存键
   * @param response 响应内容
   * @param metadata 元数据
   */
  async set(
    keys: { strict: string; normal: string; loose: string },
    response: string,
    metadata: { configName: string; model: string },
  ): Promise<void> {
    // 确保历史统计已加载
    if (!this.statsLoaded) {
      await this.ensureStatsLoaded();
    }

    // 写入 L1（使用三个键都可以命中）
    this.l1.set(keys.strict, response, { configName: metadata.configName, model: metadata.model });
    this.l1.set(keys.normal, response, { configName: metadata.configName, model: metadata.model });
    this.l1.set(keys.loose, response, { configName: metadata.configName, model: metadata.model });

    // 写入 L2
    const db = await getDb();
    const now = Date.now();

    // 检查是否已存在（用严格键检查）
    const checkStmt = db.prepare('SELECT id FROM response_cache WHERE id = ?');
    checkStmt.bind([keys.strict]);
    const exists = checkStmt.step();
    checkStmt.free();

    if (exists) {
      db.run(
        'UPDATE response_cache SET response = ?, config_name = ?, model = ?, mid_key = ?, loose_key = ?, last_used_at = ?, use_count = use_count + 1 WHERE id = ?',
        [response, metadata.configName, metadata.model, keys.normal, keys.loose, now, keys.strict],
      );
    } else {
      db.run(
        'INSERT INTO response_cache (id, mid_key, loose_key, config_name, model, response, created_at, last_used_at, use_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)',
        [keys.strict, keys.normal, keys.loose, metadata.configName, metadata.model, response, now, now],
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
    keys: { strict: string; normal: string; loose: string },
    fetcher: () => Promise<string | null>,
    metadata: { configName: string; model: string },
  ): Promise<string | null> {
    const level = await this.getLevel();
    const lookupKey = this.getKeyByLevel(keys, level);

    // 检查是否有进行中的请求
    const existing = this.inflight.get(lookupKey);
    if (existing) {
      return existing;
    }

    // 创建新请求
    const promise = (async () => {
      try {
        // 先查缓存
        const cached = await this.get(keys, level);
        if (cached !== null) {
          return cached;
        }

        // 缓存未命中，执行 fetcher
        const result = await fetcher();
        if (result !== null) {
          await this.set(keys, result, metadata);
        }
        return result;
      } finally {
        this.inflight.delete(lookupKey);
      }
    })();

    this.inflight.set(lookupKey, promise);
    return promise;
  }

  /** 清空所有缓存（L1 + L2）并重置统计 */
  async clearAll(): Promise<void> {
    this.l1.clear();
    this.hits = 0;
    this.misses = 0;
    const db = await getDb();
    db.run('DELETE FROM response_cache');
    db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('cache_hits', '0')");
    db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('cache_misses', '0')");
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
    // L1 清空后，之前的 L1 命中统计变得无意义，重置以保持一致性
    this.l1.clear();
    this.hits = 0;
    this.misses = 0;

    // 持久化重置后的统计（fire-and-forget）
    this.persistStatsAsync().catch(e => {
      console.error('[Cache] Failed to persist stats after clearExpired:', e);
    });

    requestSave();
    return count;
  }

  /** 获取缓存统计信息（首次调用时自动从 DB 加载历史统计） */
  async getStats(): Promise<CacheStats> {
    if (!this.statsLoaded) {
      await this.ensureStatsLoaded();
    }

    const db = await getDb();

    // 使用 LENGTH(response) 直接计算 UTF-8 字节长度，避免 CAST 行为不确定
    const stmt = db.prepare(
      'SELECT COUNT(*) as entries, COALESCE(SUM(LENGTH(response)), 0) as total_size FROM response_cache',
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
    const level = await this.getLevel();

    return { entries, totalSizeBytes, hits: this.hits, misses: this.misses, hitRate, ttlDays, level };
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

  /** 获取缓存档位，优先使用内存缓存 */
  async getLevel(): Promise<CacheLevel> {
    if (this.levelCache !== null) {
      return this.levelCache;
    }
    const db = await getDb();
    const stmt = db.prepare("SELECT value FROM meta WHERE key = 'cache_level'");
    let level = DEFAULT_LEVEL;
    if (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, unknown>;
      const val = row.value as string;
      if (val === 'strict' || val === 'normal' || val === 'loose') {
        level = val;
      }
    }
    stmt.free();
    this.levelCache = level;
    return level;
  }

  /** 设置缓存档位，同步更新内存缓存 */
  async setLevel(level: CacheLevel): Promise<void> {
    const db = await getDb();
    db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('cache_level', ?)", [level]);
    this.levelCache = level;
    // 切换档位时清空 L1，避免命中不同档位的缓存
    this.l1.clear();
    requestSave();
  }

  /** 从 meta 表加载历史命中/未命中统计 */
  async loadStats(): Promise<void> {
    const db = await getDb();

    const hitsStmt = db.prepare("SELECT value FROM meta WHERE key = 'cache_hits'");
    if (hitsStmt.step()) {
      const dbHits = parseInt((hitsStmt.getAsObject() as Record<string, unknown>).value as string, 10) || 0;
      // 使用较大值：首次加载时内存为 0，直接使用 DB 值
      // 如果内存已有值（本次会话增量），取较大值保留历史累计
      this.hits = Math.max(this.hits, dbHits);
    }
    hitsStmt.free();

    const missesStmt = db.prepare("SELECT value FROM meta WHERE key = 'cache_misses'");
    if (missesStmt.step()) {
      const dbMisses = parseInt((missesStmt.getAsObject() as Record<string, unknown>).value as string, 10) || 0;
      this.misses = Math.max(this.misses, dbMisses);
    }
    missesStmt.free();
  }

  /**
   * 确保统计已加载（带 Promise 缓存，避免竞态条件）
   * 多个并发调用只会执行一次 loadStats()
   */
  private async ensureStatsLoaded(): Promise<void> {
    if (this.statsLoaded) return;

    if (!this.loadStatsPromise) {
      this.loadStatsPromise = this.loadStats().then(() => {
        this.statsLoaded = true;
        this.loadStatsPromise = null;
      }).catch((err) => {
        this.loadStatsPromise = null;
        throw err;
      });
    }

    await this.loadStatsPromise;
  }

  /**
   * 定期持久化统计到 DB
   * 每 N 次 get() 操作后自动调用，避免频繁写入
   * 使用 fire-and-forget 模式，不阻塞主流程
   */
  private maybePersistStats(): void {
    this.opsSinceLastPersist++;
    if (this.opsSinceLastPersist >= this.PERSIST_INTERVAL) {
      this.opsSinceLastPersist = 0;
      // fire-and-forget：不 await，让持久化在后台执行
      this.persistStatsAsync().catch(e => {
        console.error('[Cache] Background persist failed:', e);
      });
    }
  }

  /** 异步持久化统计到 DB */
  private async persistStatsAsync(): Promise<void> {
    const db = await getDb();
    db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('cache_hits', ?)", [String(this.hits)]);
    db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('cache_misses', ?)", [String(this.misses)]);
    requestSave();
  }

  /**
   * 强制持久化统计到 DB（用于应用退出时调用）
   * 确保即使未达到持久化间隔，统计数据也不会丢失
   * 使用 fire-and-forget 模式，写入内存 DB 即时完成，后续由 closeDb() 同步持久化到磁盘
   */
  flushStats(): void {
    getDb().then(db => {
      db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('cache_hits', ?)", [String(this.hits)]);
      db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('cache_misses', ?)", [String(this.misses)]);
    }).catch(e => {
      console.error('[Cache] Failed to flush stats:', e);
    });
  }

  // ── 内部方法 ──

  /** 根据档位选择查找键 */
  private getKeyByLevel(keys: { strict: string; normal: string; loose: string }, level: CacheLevel): string {
    switch (level) {
      case 'strict': return keys.strict;
      case 'normal': return keys.normal;
      case 'loose': return keys.loose;
    }
  }

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

    // 2. 检查总体积（使用 LENGTH(response) 直接计算 UTF-8 字节长度）
    const sizeStmt = db.prepare('SELECT COALESCE(SUM(LENGTH(response)), 0) as total_size FROM response_cache');
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
          'SELECT COALESCE(SUM(LENGTH(response)), 0) as batch_size FROM (SELECT response FROM response_cache ORDER BY last_used_at ASC LIMIT 10)',
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
 * 注意：
 * - loadStats() 会在首次调用 getStats() 或 get() 时自动执行（懒加载）
 * - get() 操作的统计会定期持久化到 meta 表（每 3 次操作）
 * - clearAll() 会同时重置内存和 DB 中的统计
 * - 统计采用累加模式，避免覆盖历史数据
 * - 应用退出时会自动刷新统计到 DB
 */
export const cacheManager = new CacheManager();

export default CacheManager;

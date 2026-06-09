# LLM 响应缓存优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 LLM 响应缓存从单层 SQLite 升级为 L1 内存 + L2 SQLite 分层缓存，支持多轮对话缓存、配置感知失效和管理界面。

**Architecture:** L1 内存缓存（50条/1MB LRU Map）作为热点层，L2 SQLite 作为持久化层（100MB 体积限制）。统一缓存键包含 prompt + format + chartType + model + configName + contextHash。配置变更时自动失效相关缓存。设置中新增缓存管理面板。

**Tech Stack:** TypeScript, sql.js WASM, Next.js App Router, React 19, Tailwind CSS v4, lucide-react

**Spec:** `docs/superpowers/specs/2026-06-09-cache-optimization-design.md`

---

### Task 1: 创建 L1 内存缓存

**Files:**
- Create: `lib/cache/memory-cache.ts`

- [ ] **Step 1: 创建 MemoryCache 类**

```typescript
/**
 * L1 内存缓存 — 基于 Map 的 LRU 缓存
 * 泛型设计，可复用于任何需要内存缓存的场景
 */

interface CacheEntry<T> {
  value: T;
  size: number;
}

export class MemoryCache<T = string> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly maxEntries: number;
  private readonly maxSizeBytes: number;

  /**
   * @param maxEntries 最大条目数（默认 50）
   * @param maxSizeBytes 最大体积（字节，默认 1MB）
   */
  constructor(maxEntries = 50, maxSizeBytes = 1024 * 1024) {
    this.maxEntries = maxEntries;
    this.maxSizeBytes = maxSizeBytes;
  }

  /** 获取缓存值，命中时移到末尾（LRU） */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    // 移到末尾（Map 的迭代顺序即插入顺序）
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  /** 设置缓存值，超限时淘汰最旧条目 */
  set(key: string, value: T, size?: number): void {
    // 如果已存在，先删除旧的
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    const entrySize = size ?? this.estimateSize(value);

    // 淘汰直到有空间
    while (this.cache.size >= this.maxEntries || this.totalSize() + entrySize > this.maxSizeBytes) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }

    this.cache.set(key, { value, size: entrySize });
  }

  /** 删除缓存条目 */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /** 检查是否包含指定 key */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /** 清空所有缓存 */
  clear(): void {
    this.cache.clear();
  }

  /** 当前条目数 */
  get size(): number {
    return this.cache.size;
  }

  /** 估算值的体积（字节） */
  private estimateSize(value: T): number {
    if (typeof value === 'string') {
      // 字符串：每个字符约 2 字节（JS 使用 UTF-16）
      return value.length * 2;
    }
    // 其他类型：JSON 序列化后估算
    try {
      return JSON.stringify(value).length * 2;
    } catch {
      return 100; // 保底估算
    }
  }

  /** 计算当前总占用体积 */
  private totalSize(): number {
    let total = 0;
    for (const entry of this.cache.values()) {
      total += entry.size;
    }
    return total;
  }
}
```

- [ ] **Step 2: 验证**

在浏览器控制台或 Node 中手动测试：
```typescript
const cache = new MemoryCache<string>(3, 1000);
cache.set('a', 'hello');
cache.set('b', 'world');
cache.set('c', 'test');
cache.get('a'); // 'hello'，移到末尾
cache.set('d', 'new'); // 淘汰 'b'（最旧未访问）
cache.has('b'); // false
cache.size; // 3
```

- [ ] **Step 3: 提交**

```bash
git add lib/cache/memory-cache.ts
git commit -m "feat(cache): 新增 L1 内存缓存 MemoryCache 类"
```

---

### Task 2: 创建缓存键生成器

**Files:**
- Create: `lib/cache/cache-key.ts`

- [ ] **Step 1: 创建 CacheKeyBuilder**

```typescript
/**
 * 统一缓存键生成器
 * 确保 generate route 和 cache-manager 使用完全一致的缓存键逻辑
 */

import type { DiagramFormat } from '@/lib/types/diagram-strategy';
import type { LLMMessage } from '@/lib/types';

interface CacheKeyInput {
  prompt: string;
  format: DiagramFormat;
  chartType: string;
  model: string;
  configName: string;
  contextHash?: string;
}

/** SHA-256 哈希，取前 16 位 hex */
async function sha256(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

/**
 * 构建缓存键
 * 所有可能影响 LLM 输出的因素都应包含在内
 */
export async function buildCacheKey(input: CacheKeyInput): Promise<string> {
  const parts = [
    input.prompt,
    input.format,
    input.chartType,
    input.model,
    input.configName,
    input.contextHash ?? '',
  ].join('|');
  return sha256(parts);
}

/**
 * 构建多轮对话上下文哈希
 * 取最近 N 条消息的内容做哈希，避免全量上下文导致命中率过低
 *
 * @param messages 完整消息列表
 * @param maxMessages 取最近几条（默认 6）
 */
export async function buildContextHash(
  messages: LLMMessage[],
  maxMessages = 6,
): Promise<string> {
  const recent = messages.slice(-maxMessages);
  const content = recent.map(m => `${m.role}:${typeof m.content === 'string' ? m.content : '[multimodal]'}`).join('\n');
  const hash = await sha256(content);
  return hash.substring(0, 8);
}
```

- [ ] **Step 2: 提交**

```bash
git add lib/cache/cache-key.ts
git commit -m "feat(cache): 新增统一缓存键生成器"
```

---

### Task 3: 数据库 Schema 迁移

**Files:**
- Modify: `lib/db/index.ts:104-118`

- [ ] **Step 1: 给 response_cache 表新增列和索引**

在 `lib/db/index.ts` 中，将现有的 `response_cache` 表创建代码替换为：

```typescript
  // AI 响应缓存表
  db.run(`
    CREATE TABLE IF NOT EXISTS response_cache (
      id TEXT PRIMARY KEY,
      prompt_hash TEXT NOT NULL,
      format TEXT NOT NULL,
      chart_type TEXT NOT NULL,
      config_name TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '',
      response TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_used_at INTEGER NOT NULL,
      use_count INTEGER DEFAULT 1
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_response_cache_hash ON response_cache(prompt_hash, format, chart_type)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_response_cache_last_used ON response_cache(last_used_at DESC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_response_cache_config ON response_cache(config_name, model)`);
```

同时，为了兼容已存在的数据库，在 `initDb()` 函数的 `CREATE TABLE` 之后、索引创建之前，添加 ALTER TABLE 语句：

```typescript
  // 兼容旧数据库：新增 config_name 和 model 列
  try {
    db.run("ALTER TABLE response_cache ADD COLUMN config_name TEXT NOT NULL DEFAULT ''");
  } catch {
    // 列已存在，忽略
  }
  try {
    db.run("ALTER TABLE response_cache ADD COLUMN model TEXT NOT NULL DEFAULT ''");
  } catch {
    // 列已存在，忽略
  }
```

- [ ] **Step 2: 验证**

启动开发服务器，确认数据库初始化无报错：
```bash
cd ai-sketch && pnpm dev
```
控制台不应出现 `[DB]` 相关错误。

- [ ] **Step 3: 提交**

```bash
git add lib/db/index.ts
git commit -m "feat(db): response_cache 表新增 config_name 和 model 列"
```

---

### Task 4: 重构 CacheManager — L1/L2 协调器

**Files:**
- Modify: `lib/db/cache-manager.ts`（完全重写）

- [ ] **Step 1: 重写 CacheManager**

```typescript
/**
 * LLM 响应缓存管理器 — L1 内存 + L2 SQLite 分层缓存
 */

import { getDb, requestSave } from './index';
import { generateId } from '@/lib/utils';
import { MemoryCache } from '@/lib/cache/memory-cache';
import type { DiagramFormat } from '@/lib/types/diagram-strategy';

interface CacheEntry {
  id: string;
  promptHash: string;
  format: DiagramFormat;
  chartType: string;
  configName: string;
  model: string;
  response: string;
  createdAt: number;
  lastUsedAt: number;
  useCount: number;
}

/** 将数据库行对象解析为 CacheEntry */
function rowToCacheEntry(row: Record<string, unknown>): CacheEntry {
  return {
    id: row.id as string,
    promptHash: row.prompt_hash as string,
    format: row.format as DiagramFormat,
    chartType: row.chart_type as string,
    configName: (row.config_name as string) ?? '',
    model: (row.model as string) ?? '',
    response: row.response as string,
    createdAt: row.created_at as number,
    lastUsedAt: row.last_used_at as number,
    useCount: (row.use_count as number) ?? 1,
  };
}

interface CacheStats {
  entries: number;
  totalSizeBytes: number;
  hits: number;
  misses: number;
  hitRate: number;
  ttlDays: number;
}

class CacheManager {
  /** L1 内存缓存：50 条，1MB */
  private l1 = new MemoryCache<string>(50, 1024 * 1024);

  /** 命中率统计 */
  private stats = { hits: 0, misses: 0 };

  /** 进行中的请求（穿透保护） */
  private inflightRequests = new Map<string, Promise<string | null>>();

  /** TTL（毫秒），默认 7 天，可从 DB 动态读取 */
  private ttlCache: number | null = null;
  private readonly DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000;

  /** 体积上限（字节）：100MB */
  private readonly MAX_SIZE_BYTES = 100 * 1024 * 1024;

  // ── Public API ──

  /**
   * 获取缓存（L1 → L2 逐级查找）
   * @param cacheKey 完整缓存键（由 cache-key.ts 生成）
   */
  async get(cacheKey: string): Promise<string | null> {
    // L1 查找
    const l1Result = this.l1.get(cacheKey);
    if (l1Result !== undefined) {
      this.stats.hits++;
      // 异步更新 L2 的 last_used_at（不阻塞返回）
      this.updateL2Access(cacheKey).catch(() => {});
      return l1Result;
    }

    // L2 查找
    const db = await getDb();
    const stmt = db.prepare(
      'SELECT * FROM response_cache WHERE id = ? OR (prompt_hash = ? AND format = ? AND chart_type = ? AND config_name = ? AND model = ?)',
    );
    // 注意：cacheKey 是哈希后的 key，不是原始 prompt_hash
    // 我们需要通过 cacheKey 来查找，但 DB 中存的是 prompt_hash
    // 改用另一种方式：直接按 cacheKey 查找（需要在 DB 中存储 cacheKey）
    stmt.free();

    // 重新设计：直接按 cacheKey 作为主键查找
    const stmt2 = db.prepare('SELECT * FROM response_cache WHERE id = ?');
    stmt2.bind([cacheKey]);
    let entry: CacheEntry | null = null;
    if (stmt2.step()) {
      entry = rowToCacheEntry(stmt2.getAsObject() as Record<string, unknown>);
    }
    stmt2.free();

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // 检查过期
    const now = Date.now();
    const ttl = await this.getTtl();
    if (now - entry.createdAt > ttl) {
      await this.deleteEntry(entry.id);
      this.stats.misses++;
      return null;
    }

    // 更新 L2 访问记录
    db.run(
      'UPDATE response_cache SET last_used_at = ?, use_count = use_count + 1 WHERE id = ?',
      [now, entry.id],
    );
    requestSave();

    // 回填 L1
    this.l1.set(cacheKey, entry.response);
    this.stats.hits++;
    return entry.response;
  }

  /**
   * 设置缓存（写入 L1 + L2）
   * @param cacheKey 完整缓存键
   * @param response LLM 响应内容
   * @param metadata 元数据（用于按配置失效）
   */
  async set(
    cacheKey: string,
    response: string,
    metadata: { configName: string; model: string },
  ): Promise<void> {
    // 写入 L1
    this.l1.set(cacheKey, response);

    // 写入 L2
    const db = await getDb();
    const now = Date.now();

    // 检查是否已存在
    const existingStmt = db.prepare('SELECT id FROM response_cache WHERE id = ?');
    existingStmt.bind([cacheKey]);
    const exists = existingStmt.step();
    existingStmt.free();

    if (exists) {
      db.run(
        'UPDATE response_cache SET response = ?, last_used_at = ?, use_count = use_count + 1, config_name = ?, model = ? WHERE id = ?',
        [response, now, metadata.configName, metadata.model, cacheKey],
      );
    } else {
      // prompt_hash 存储 cacheKey 的前缀部分（用于调试），id 直接用 cacheKey
      db.run(
        `INSERT INTO response_cache (id, prompt_hash, format, chart_type, config_name, model, response, created_at, last_used_at, use_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [cacheKey, cacheKey.substring(0, 8), '', '', metadata.configName, metadata.model, response, now, now],
      );
    }

    // 清理过期和超限
    await this.cleanup();
  }

  /**
   * 带穿透保护的缓存获取
   * 多个并发请求命中同一 key 时，只发起一次 LLM 调用
   */
  async getOrFetch(
    cacheKey: string,
    fetcher: () => Promise<string>,
    metadata: { configName: string; model: string },
  ): Promise<string | null> {
    // 查缓存
    const cached = await this.get(cacheKey);
    if (cached) return cached;

    // 检查是否有进行中的请求
    const inflight = this.inflightRequests.get(cacheKey);
    if (inflight) return inflight;

    // 发起新请求
    const promise = fetcher().then(async (result) => {
      await this.set(cacheKey, result, metadata);
      this.inflightRequests.delete(cacheKey);
      return result;
    }).catch((err) => {
      this.inflightRequests.delete(cacheKey);
      throw err;
    });
    this.inflightRequests.set(cacheKey, promise);
    return promise;
  }

  /** 清空所有缓存 */
  async clearAll(): Promise<void> {
    const db = await getDb();
    db.run('DELETE FROM response_cache');
    this.l1.clear();
    this.stats = { hits: 0, misses: 0 };
    requestSave();
  }

  /** 按配置清除缓存 */
  async clearByConfig(configName: string, model: string): Promise<number> {
    const db = await getDb();
    db.run('DELETE FROM response_cache WHERE config_name = ? AND model = ?', [configName, model]);
    const count = db.getRowsModified();
    this.l1.clear(); // L1 无法按条件清除，全清
    requestSave();
    return count;
  }

  /** 清除过期缓存 */
  async clearExpired(): Promise<number> {
    const db = await getDb();
    const ttl = await this.getTtl();
    db.run('DELETE FROM response_cache WHERE created_at < ?', [Date.now() - ttl]);
    const count = db.getRowsModified();
    this.l1.clear();
    requestSave();
    return count;
  }

  /** 获取缓存统计 */
  async getStats(): Promise<CacheStats> {
    const db = await getDb();
    const ttl = await this.getTtl();

    const countStmt = db.prepare('SELECT COUNT(*) as total, COALESCE(SUM(LENGTH(response)), 0) as total_size, COALESCE(SUM(use_count), 0) as total_uses FROM response_cache');
    let entries = 0;
    let totalSizeBytes = 0;
    let totalUses = 0;
    if (countStmt.step()) {
      const row = countStmt.getAsObject() as Record<string, unknown>;
      entries = (row.total as number) ?? 0;
      totalSizeBytes = (row.total_size as number) ?? 0;
      totalUses = (row.total_uses as number) ?? 0;
    }
    countStmt.free();

    const total = this.stats.hits + this.stats.misses;
    return {
      entries,
      totalSizeBytes,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      ttlDays: Math.round(ttl / (24 * 60 * 60 * 1000)),
    };
  }

  /** 获取 TTL（毫秒） */
  async getTtl(): Promise<number> {
    if (this.ttlCache !== null) return this.ttlCache;
    try {
      const db = await getDb();
      const stmt = db.prepare("SELECT value FROM meta WHERE key = 'cache_ttl_days'");
      if (stmt.step()) {
        const row = stmt.getAsObject() as Record<string, unknown>;
        const days = parseInt(row.value as string, 10);
        if (!isNaN(days) && days > 0) {
          this.ttlCache = days * 24 * 60 * 60 * 1000;
          stmt.free();
          return this.ttlCache;
        }
      }
      stmt.free();
    } catch {
      // DB 不可用时使用默认值
    }
    this.ttlCache = this.DEFAULT_TTL;
    return this.ttlCache;
  }

  /** 设置 TTL（天） */
  async setTtl(days: number): Promise<void> {
    if (days <= 0) throw new Error('TTL 必须大于 0');
    const db = await getDb();
    db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('cache_ttl_days', ?)", [String(days)]);
    this.ttlCache = days * 24 * 60 * 60 * 1000;
    requestSave();
  }

  /** 刷新统计（从 DB 恢复命中率数据） */
  async loadStats(): Promise<void> {
    try {
      const db = await getDb();
      const hitsStmt = db.prepare("SELECT value FROM meta WHERE key = 'cache_hits'");
      if (hitsStmt.step()) {
        this.stats.hits = parseInt((hitsStmt.getAsObject() as Record<string, unknown>).value as string, 10) || 0;
      }
      hitsStmt.free();

      const missesStmt = db.prepare("SELECT value FROM meta WHERE key = 'cache_misses'");
      if (missesStmt.step()) {
        this.stats.misses = parseInt((missesStmt.getAsObject() as Record<string, unknown>).value as string, 10) || 0;
      }
      missesStmt.free();
    } catch {
      // 忽略
    }
  }

  /** 保存命中率统计到 DB */
  private async saveStats(): Promise<void> {
    try {
      const db = await getDb();
      db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('cache_hits', ?)", [String(this.stats.hits)]);
      db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('cache_misses', ?)", [String(this.stats.misses)]);
      requestSave();
    } catch {
      // 忽略
    }
  }

  // ── Private ──

  /** 删除单条缓存 */
  private async deleteEntry(id: string): Promise<void> {
    const db = await getDb();
    db.run('DELETE FROM response_cache WHERE id = ?', [id]);
    requestSave();
  }

  /** 更新 L2 访问记录（异步，不阻塞主流程） */
  private async updateL2Access(cacheKey: string): Promise<void> {
    const db = await getDb();
    db.run(
      'UPDATE response_cache SET last_used_at = ?, use_count = use_count + 1 WHERE id = ?',
      [Date.now(), cacheKey],
    );
    requestSave();
  }

  /** 清理过期和超限缓存 */
  private async cleanup(): Promise<void> {
    const db = await getDb();
    const now = Date.now();
    const ttl = await this.getTtl();

    // 1. 删除过期条目
    db.run('DELETE FROM response_cache WHERE created_at < ?', [now - ttl]);

    // 2. 检查总体积
    const sizeStmt = db.prepare('SELECT COALESCE(SUM(LENGTH(response)), 0) as total_size FROM response_cache');
    let totalSize = 0;
    if (sizeStmt.step()) {
      totalSize = (sizeStmt.getAsObject() as Record<string, unknown>).total_size as number;
    }
    sizeStmt.free();

    // 3. 超过 90% 上限时，按 last_used_at 升序淘汰
    if (totalSize > this.MAX_SIZE_BYTES * 0.9) {
      let currentSize = totalSize;
      while (currentSize > this.MAX_SIZE_BYTES * 0.8) {
        db.run(
          'DELETE FROM response_cache WHERE id IN (SELECT id FROM response_cache ORDER BY last_used_at ASC LIMIT 10)',
        );
        // 重新计算
        const recheckStmt = db.prepare('SELECT COALESCE(SUM(LENGTH(response)), 0) as total_size FROM response_cache');
        if (recheckStmt.step()) {
          currentSize = (recheckStmt.getAsObject() as Record<string, unknown>).total_size as number;
        }
        recheckStmt.free();
        if (db.getRowsModified() === 0) break;
      }
    }

    requestSave();

    // 异步保存命中率统计
    this.saveStats().catch(() => {});
  }
}

export const cacheManager = new CacheManager();
export default CacheManager;
```

- [ ] **Step 2: 验证**

启动开发服务器，确认无编译错误：
```bash
cd ai-sketch && pnpm dev
```

- [ ] **Step 3: 提交**

```bash
git add lib/db/cache-manager.ts
git commit -m "feat(cache): 重构 CacheManager 为 L1/L2 分层缓存协调器"
```

---

### Task 5: 创建缓存失效器

**Files:**
- Create: `lib/cache/cache-invalidator.ts`

- [ ] **Step 1: 创建 CacheInvalidator**

```typescript
/**
 * 缓存失效器
 * 在配置变更/删除时自动清除相关缓存
 */

import { cacheManager } from '@/lib/db/cache-manager';

class CacheInvalidator {
  /**
   * 按配置失效缓存
   * 当配置的 model 或 name 变更时调用
   */
  async invalidateByConfig(configName: string, model: string): Promise<number> {
    return cacheManager.clearByConfig(configName, model);
  }

  /** 清除所有缓存 */
  async invalidateAll(): Promise<void> {
    return cacheManager.clearAll();
  }

  /** 清除过期缓存 */
  async invalidateExpired(): Promise<number> {
    return cacheManager.clearExpired();
  }
}

export const cacheInvalidator = new CacheInvalidator();
export default CacheInvalidator;
```

- [ ] **Step 2: 提交**

```bash
git add lib/cache/cache-invalidator.ts
git commit -m "feat(cache): 新增配置感知的缓存失效器"
```

---

### Task 6: 集成缓存失效到 ConfigManager

**Files:**
- Modify: `lib/db/config-manager.ts`

- [ ] **Step 1: 在 deleteConfig 中集成缓存失效**

找到 `deleteConfig` 方法，在删除配置前先清除相关缓存：

```typescript
async deleteConfig(id: string): Promise<void> {
  const db = await getDb();
  // 先获取配置信息，用于清除相关缓存
  const config = await this.getConfig(id);
  if (config) {
    const { cacheInvalidator } = await import('@/lib/cache/cache-invalidator');
    await cacheInvalidator.invalidateByConfig(config.name || config.type, config.model);
  }
  withTransaction(db, () => {
    db.run('DELETE FROM config_tag_relations WHERE config_id = ?', [id]);
    db.run('DELETE FROM llm_configs WHERE id = ?', [id]);
  });
}
```

- [ ] **Step 2: 在 updateConfig 中集成缓存失效**

找到 `updateConfig` 方法，当 model 或 name 变更时清除旧缓存：

```typescript
async updateConfig(id: string, data: Partial<LLMConfig>): Promise<LLMConfig> {
  const db = await getDb();
  const existing = await this.getConfig(id);
  if (!existing) throw new Error('Config not found');

  // 如果 model 或 name 变更，清除旧配置的缓存
  if ((data.model && data.model !== existing.model) || (data.name && data.name !== existing.name)) {
    const { cacheInvalidator } = await import('@/lib/cache/cache-invalidator');
    await cacheInvalidator.invalidateByConfig(existing.name || existing.type, existing.model);
  }

  // ... 现有的更新逻辑
}
```

- [ ] **Step 3: 提交**

```bash
git add lib/db/config-manager.ts
git commit -m "feat(cache): 配置变更/删除时自动失效相关缓存"
```

---

### Task 7: 更新 Generate Route 集成新缓存系统

**Files:**
- Modify: `app/api/generate/route.ts`

- [ ] **Step 1: 更新 imports**

```typescript
import { cacheManager } from '@/lib/db/cache-manager';
import { buildCacheKey, buildContextHash } from '@/lib/cache/cache-key';
```

- [ ] **Step 2: 替换缓存键构建逻辑**

将原来的缓存键构建代码（约第 185-189 行）替换为：

```typescript
    // ── 检查缓存（仅对非图片输入、非重新生成的请求生效）──
    const shouldCache = allImages.length === 0 && !regenerate;
    let cacheKeyValue: string | null = null;

    if (shouldCache) {
      // 构建上下文哈希（多轮对话支持）
      const contextHash = contextMessages.length > 1
        ? await buildContextHash(contextMessages)
        : undefined;

      cacheKeyValue = await buildCacheKey({
        prompt: strategy.getUserPrompt(userContent, chartType),
        format: diagramFormat,
        chartType,
        model: config.model,
        configName: config.name || config.type,
        contextHash,
      });
    }
```

- [ ] **Step 3: 替换缓存查找和写入逻辑**

将原来的缓存查找代码（约第 192-200 行）替换为：

```typescript
    let cachedResponse: string | null = null;
    if (cacheKeyValue) {
      perfMark('Cache Lookup');
      cachedResponse = await cacheManager.get(cacheKeyValue);
      perfEnd('Cache Lookup');
      if (cachedResponse) {
        console.log('[Generate] Cache hit');
      }
    }
```

将原来的缓存写入代码（约第 292-294 行）替换为：

```typescript
            // 保存到缓存
            if (cacheKeyValue) {
              await cacheManager.set(cacheKeyValue, optimizedCode, {
                configName: config.name || config.type,
                model: config.model,
              });
            }
```

- [ ] **Step 4: 优化缓存命中时的流式输出**

将原来的模拟流式输出代码（约第 232-237 行）替换为：

```typescript
            // 模拟流式输出（更自然的节奏）
            const chunkSize = 100;
            const delayMs = 10;
            for (let i = 0; i < optimizedCode.length; i += chunkSize) {
              const chunk = optimizedCode.substring(i, i + chunkSize);
              const data = `data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`;
              controller.enqueue(encoder.encode(data));
              await new Promise(r => setTimeout(r, delayMs));
            }
```

- [ ] **Step 5: 验证**

启动开发服务器，测试生成图表：
```bash
cd ai-sketch && pnpm dev
```
- 第一次生成应调用 LLM（控制台无 `Cache hit`）
- 相同输入再次生成应命中缓存（控制台显示 `Cache hit`）

- [ ] **Step 6: 提交**

```bash
git add app/api/generate/route.ts
git commit -m "feat(cache): generate route 集成新的 L1/L2 缓存系统"
```

---

### Task 8: 创建缓存管理 API 端点

**Files:**
- Create: `app/api/cache/stats/route.ts`
- Create: `app/api/cache/clear/route.ts`
- Create: `app/api/cache/ttl/route.ts`

- [ ] **Step 1: 创建 stats 端点**

```typescript
// app/api/cache/stats/route.ts
import { NextResponse } from 'next/server';
import { cacheManager } from '@/lib/db/cache-manager';

export async function GET() {
  try {
    await cacheManager.loadStats();
    const stats = await cacheManager.getStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching cache stats:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
```

- [ ] **Step 2: 创建 clear 端点**

```typescript
// app/api/cache/clear/route.ts
import { NextResponse } from 'next/server';
import { cacheManager } from '@/lib/db/cache-manager';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, configName, model } = body as {
      type: 'all' | 'expired' | 'byConfig';
      configName?: string;
      model?: string;
    };

    switch (type) {
      case 'all':
        await cacheManager.clearAll();
        return NextResponse.json({ success: true });

      case 'expired': {
        const count = await cacheManager.clearExpired();
        return NextResponse.json({ success: true, count });
      }

      case 'byConfig': {
        if (!configName || !model) {
          return NextResponse.json({ error: 'configName 和 model 为必填' }, { status: 400 });
        }
        const count = await cacheManager.clearByConfig(configName, model);
        return NextResponse.json({ success: true, count });
      }

      default:
        return NextResponse.json({ error: `未知类型: ${type}` }, { status: 400 });
    }
  } catch (error) {
    console.error('Error clearing cache:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
```

- [ ] **Step 3: 创建 ttl 端点**

```typescript
// app/api/cache/ttl/route.ts
import { NextResponse } from 'next/server';
import { cacheManager } from '@/lib/db/cache-manager';

export async function GET() {
  try {
    const ttl = await cacheManager.getTtl();
    return NextResponse.json({ ttlDays: Math.round(ttl / (24 * 60 * 60 * 1000)) });
  } catch (error) {
    console.error('Error fetching cache TTL:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { ttlDays } = body as { ttlDays: number };
    await cacheManager.setTtl(ttlDays);
    return NextResponse.json({ success: true, ttlDays });
  } catch (error) {
    console.error('Error setting cache TTL:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
```

- [ ] **Step 4: 提交**

```bash
git add app/api/cache/
git commit -m "feat(cache): 新增缓存管理 API 端点（stats/clear/ttl）"
```

---

### Task 9: 清理旧的缓存 API 和客户端方法

**Files:**
- Modify: `app/api/configs/actions/route.ts`
- Modify: `lib/api/client.ts`

- [ ] **Step 1: 从 configs/actions 中移除缓存相关 action**

在 `app/api/configs/actions/route.ts` 中，删除 `'clear-cache'` 和 `'cache-stats'` 两个 handler：

```typescript
  // 删除这两个 handler：
  // 'clear-cache': async () => { ... },
  // 'cache-stats': async () => { ... },
```

同时移除顶部的 `import { cacheManager } from '@/lib/db/cache-manager';`。

- [ ] **Step 2: 更新 client.ts 中的缓存 API 方法**

将 `lib/api/client.ts` 中的 `clearCache` 和 `fetchCacheStats` 替换为新端点：

```typescript
/** 清除所有缓存 */
export async function clearCache(): Promise<{ success: boolean }> {
  return request('/api/cache/clear', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'all' }),
  });
}

/** 按配置清除缓存 */
export async function clearCacheByConfig(configName: string, model: string): Promise<{ success: boolean; count: number }> {
  return request('/api/cache/clear', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'byConfig', configName, model }),
  });
}

/** 清除过期缓存 */
export async function clearExpiredCache(): Promise<{ success: boolean; count: number }> {
  return request('/api/cache/clear', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'expired' }),
  });
}

/** 获取缓存统计 */
export async function fetchCacheStats(): Promise<{
  entries: number;
  totalSizeBytes: number;
  hits: number;
  misses: number;
  hitRate: number;
  ttlDays: number;
}> {
  return request('/api/cache/stats');
}

/** 获取缓存 TTL */
export async function fetchCacheTtl(): Promise<{ ttlDays: number }> {
  return request('/api/cache/ttl');
}

/** 设置缓存 TTL */
export async function setCacheTtl(ttlDays: number): Promise<{ success: boolean; ttlDays: number }> {
  return request('/api/cache/ttl', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ttlDays }),
  });
}
```

- [ ] **Step 3: 更新 DataSettings 中的缓存统计调用**

`components/settings/DataSettings.tsx` 中的 `fetchCacheStats()` 调用需要适配新的返回格式：

```typescript
// 原来：setCacheCount(cacheResult.total);
// 改为：
setCacheCount(cacheResult.entries);
```

- [ ] **Step 4: 提交**

```bash
git add app/api/configs/actions/route.ts lib/api/client.ts components/settings/DataSettings.tsx
git commit -m "refactor(cache): 迁移缓存 API 到独立端点，清理旧代码"
```

---

### Task 10: 创建缓存管理 UI

**Files:**
- Create: `components/settings/CacheSettings.tsx`

- [ ] **Step 1: 创建 CacheSettings 组件**

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import * as api from '@/lib/api/client';
import { useLocale } from '@/lib/locales';
import ConfirmDialog from '@/components/dialogs/ConfirmDialog';
import { useNotification } from '@/lib/contexts/NotificationContext';
import { Database, Trash2, Zap, Clock, BarChart3, Settings } from 'lucide-react';
import type { ConfirmDialogState } from '@/lib/types';
import type { LLMConfig } from '@/lib/types';

/** 格式化字节数 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/** 格式化百分比 */
function formatPercent(value: number): string {
  return Math.round(value * 100) + '%';
}

/** 缓存管理组件 */
export default function CacheSettings() {
  const { t } = useLocale();
  const { showNotification } = useNotification();

  // ── Stats ──
  const [stats, setStats] = useState<{
    entries: number;
    totalSizeBytes: number;
    hits: number;
    misses: number;
    hitRate: number;
    ttlDays: number;
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // ── TTL ──
  const [ttlInput, setTtlInput] = useState('7');
  const [isSavingTtl, setIsSavingTtl] = useState(false);

  // ── Configs ──
  const [configs, setConfigs] = useState<LLMConfig[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<LLMConfig | null>(null);

  // ── Operations ──
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [isClearingExpired, setIsClearingExpired] = useState(false);
  const [isClearingByConfig, setIsClearingByConfig] = useState(false);

  // ── Confirm dialog ──
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
  });

  /** 加载统计数据 */
  const loadStats = useCallback(async () => {
    try {
      const [statsResult, ttlResult, configsResult] = await Promise.all([
        api.fetchCacheStats(),
        api.fetchCacheTtl(),
        api.fetchConfigs(),
      ]);
      setStats(statsResult);
      setTtlInput(String(statsResult.ttlDays));
      setConfigs(configsResult.configs);
    } catch (err) {
      console.error('Failed to load cache stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  /** 清除全部缓存 */
  const handleClearAll = () => {
    setConfirmDialog({
      isOpen: true,
      title: t('cache.clearAll'),
      message: t('cache.clearAllConfirm'),
      onConfirm: async () => {
        setIsClearingAll(true);
        try {
          await api.clearCache();
          await loadStats();
          showNotification('', t('cache.clearSuccess'), 'success');
        } catch (err) {
          console.error('Clear cache failed:', err);
          showNotification('', t('settings.operationFailed'), 'error');
        } finally {
          setIsClearingAll(false);
        }
      },
    });
  };

  /** 清除过期缓存 */
  const handleClearExpired = async () => {
    setIsClearingExpired(true);
    try {
      const result = await api.clearExpiredCache();
      await loadStats();
      showNotification('', t('cache.clearSuccess'), 'success');
    } catch (err) {
      console.error('Clear expired cache failed:', err);
      showNotification('', t('settings.operationFailed'), 'error');
    } finally {
      setIsClearingExpired(false);
    }
  };

  /** 按配置清除缓存 */
  const handleClearByConfig = async () => {
    if (!selectedConfig) return;
    setIsClearingByConfig(true);
    try {
      await api.clearCacheByConfig(
        selectedConfig.name || selectedConfig.type,
        selectedConfig.model,
      );
      await loadStats();
      showNotification('', t('cache.clearSuccess'), 'success');
    } catch (err) {
      console.error('Clear cache by config failed:', err);
      showNotification('', t('settings.operationFailed'), 'error');
    } finally {
      setIsClearingByConfig(false);
    }
  };

  /** 保存 TTL */
  const handleSaveTtl = async () => {
    const days = parseInt(ttlInput, 10);
    if (isNaN(days) || days <= 0) {
      showNotification('', t('settings.operationFailed'), 'error');
      return;
    }
    setIsSavingTtl(true);
    try {
      await api.setCacheTtl(days);
      await loadStats();
      showNotification('', t('cache.ttlSaved'), 'success');
    } catch (err) {
      console.error('Save TTL failed:', err);
      showNotification('', t('settings.operationFailed'), 'error');
    } finally {
      setIsSavingTtl(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={18} className="text-[var(--accent-indigo)]" />
          <h3 className="text-lg font-semibold text-[var(--fg)]">{t('cache.stats')}</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[var(--surface-warm-hover)] border border-[var(--border)]">
            <p className="text-sm text-[var(--muted)] mb-1">{t('cache.entries')}</p>
            <p className="text-2xl font-semibold text-[var(--fg)]">
              {statsLoading ? '...' : (stats?.entries ?? 0)}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[var(--surface-warm-hover)] border border-[var(--border)]">
            <p className="text-sm text-[var(--muted)] mb-1">{t('cache.size')}</p>
            <p className="text-2xl font-semibold text-[var(--fg)]">
              {statsLoading ? '...' : formatBytes(stats?.totalSizeBytes ?? 0)}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[var(--surface-warm-hover)] border border-[var(--border)]">
            <p className="text-sm text-[var(--muted)] mb-1">{t('cache.hitRate')}</p>
            <p className="text-2xl font-semibold text-[var(--fg)]">
              {statsLoading ? '...' : formatPercent(stats?.hitRate ?? 0)}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[var(--surface-warm-hover)] border border-[var(--border)]">
            <p className="text-sm text-[var(--muted)] mb-1">{t('cache.hits')}</p>
            <p className="text-2xl font-semibold text-[var(--fg)]">
              {statsLoading ? '...' : (stats?.hits ?? 0)}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[var(--surface-warm-hover)] border border-[var(--border)]">
            <p className="text-sm text-[var(--muted)] mb-1">{t('cache.misses')}</p>
            <p className="text-2xl font-semibold text-[var(--fg)]">
              {statsLoading ? '...' : (stats?.misses ?? 0)}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[var(--surface-warm-hover)] border border-[var(--border)]">
            <p className="text-sm text-[var(--muted)] mb-1">{t('cache.ttl')}</p>
            <p className="text-2xl font-semibold text-[var(--fg)]">
              {statsLoading ? '...' : `${stats?.ttlDays ?? 7} ${t('cache.days')}`}
            </p>
          </div>
        </div>
      </section>

      {/* 操作区 */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Zap size={18} className="text-[var(--accent-indigo)]" />
          <h3 className="text-lg font-semibold text-[var(--fg)]">{t('cache.operations')}</h3>
        </div>
        <div className="space-y-3">
          {/* 清除全部 */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--surface-warm-hover)] border border-[var(--border)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--fg)]">{t('cache.clearAll')}</p>
                <p className="text-xs text-[var(--muted)]">{t('cache.clearAllDesc')}</p>
              </div>
            </div>
            <button
              onClick={handleClearAll}
              disabled={isClearingAll || (stats?.entries ?? 0) === 0}
              className="flex items-center justify-center gap-1.5 w-24 py-2 text-sm font-medium text-red-500 bg-red-500/10 hover:bg-red-500/15 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 size={14} className={isClearingAll ? 'animate-pulse' : ''} />
              <span>{isClearingAll ? t('common.loading') : t('cache.clearAll')}</span>
            </button>
          </div>

          {/* 清除过期 */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--surface-warm-hover)] border border-[var(--border)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Clock size={18} className="text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--fg)]">{t('cache.clearExpired')}</p>
                <p className="text-xs text-[var(--muted)]">{t('cache.clearExpiredDesc')}</p>
              </div>
            </div>
            <button
              onClick={handleClearExpired}
              disabled={isClearingExpired}
              className="flex items-center justify-center gap-1.5 w-24 py-2 text-sm font-medium text-amber-500 bg-amber-500/10 hover:bg-amber-500/15 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Clock size={14} className={isClearingExpired ? 'animate-spin' : ''} />
              <span>{isClearingExpired ? t('common.loading') : t('cache.clearExpired')}</span>
            </button>
          </div>
        </div>
      </section>

      {/* 按配置清理 */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Database size={18} className="text-[var(--accent-indigo)]" />
          <h3 className="text-lg font-semibold text-[var(--fg)]">{t('cache.clearByConfig')}</h3>
        </div>
        <div className="p-4 rounded-xl bg-[var(--surface-warm-hover)] border border-[var(--border)] space-y-3">
          <div className="flex items-center gap-3">
            <select
              value={selectedConfig?.id ?? ''}
              onChange={(e) => {
                const config = configs.find(c => c.id === e.target.value) ?? null;
                setSelectedConfig(config);
              }}
              className="flex-1 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-warm)] text-[var(--fg)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-indigo)]/20"
            >
              <option value="">{t('cache.selectConfig')}</option>
              {configs.map(config => (
                <option key={config.id} value={config.id}>
                  {config.name || config.type} — {config.model}
                </option>
              ))}
            </select>
            <button
              onClick={handleClearByConfig}
              disabled={!selectedConfig || isClearingByConfig}
              className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-[var(--accent-indigo)] bg-[var(--accent-indigo)]/10 hover:bg-[var(--accent-indigo)]/15 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 size={14} className={isClearingByConfig ? 'animate-pulse' : ''} />
              <span>{isClearingByConfig ? t('common.loading') : t('cache.clearByConfig')}</span>
            </button>
          </div>
        </div>
      </section>

      {/* TTL 设置 */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Settings size={18} className="text-[var(--accent-indigo)]" />
          <h3 className="text-lg font-semibold text-[var(--fg)]">{t('cache.ttlSettings')}</h3>
        </div>
        <div className="p-4 rounded-xl bg-[var(--surface-warm-hover)] border border-[var(--border)]">
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--muted)]">{t('cache.ttlLabel')}</span>
            <input
              type="number"
              min="1"
              max="365"
              value={ttlInput}
              onChange={(e) => setTtlInput(e.target.value)}
              className="w-20 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-warm)] text-[var(--fg)] text-sm text-center focus:outline-none focus:ring-2 focus:ring-[var(--accent-indigo)]/20"
            />
            <span className="text-sm text-[var(--muted)]">{t('cache.days')}</span>
            <button
              onClick={handleSaveTtl}
              disabled={isSavingTtl}
              className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-[var(--accent-indigo)] bg-[var(--accent-indigo)]/10 hover:bg-[var(--accent-indigo)]/15 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{isSavingTtl ? t('common.loading') : t('common.save')}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={() => {
          confirmDialog.onConfirm?.();
          setConfirmDialog({ ...confirmDialog, isOpen: false });
        }}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type="danger"
      />
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add components/settings/CacheSettings.tsx
git commit -m "feat(cache): 新增缓存管理 UI 组件"
```

---

### Task 11: 注册缓存管理 Tab 到设置页面

**Files:**
- Modify: `components/settings/SettingsSidebar.tsx`
- Modify: `app/settings/page.tsx`

- [ ] **Step 1: 更新 SettingsSidebar**

在 `SettingsSidebar.tsx` 中，给 `SettingsTab` 类型添加 `'cache'`，并在 `tabs` 数组中添加缓存入口（放在 data 和 shortcuts 之间）：

```typescript
import { Palette, Wand2, Globe, MessageSquare, Database, Keyboard, Info, Tags, HardDrive, LucideIcon } from 'lucide-react';

export type SettingsTab = 'appearance' | 'llm' | 'tags' | 'data' | 'cache' | 'shortcuts' | 'network' | 'about';

const tabs: { key: SettingsTab; icon: LucideIcon; labelKey: TranslationKey }[] = [
  { key: 'appearance', icon: Palette, labelKey: 'settings.appearance' },
  { key: 'llm', icon: Wand2, labelKey: 'settings.llm' },
  { key: 'conversations', icon: MessageSquare, labelKey: 'settings.conversations' },
  { key: 'tags', icon: Tags, labelKey: 'tags.title' },
  { key: 'data', icon: Database, labelKey: 'settings.data' },
  { key: 'cache', icon: HardDrive, labelKey: 'settings.cache' },
  { key: 'shortcuts', icon: Keyboard, labelKey: 'settings.shortcuts' },
  { key: 'network', icon: Globe, labelKey: 'settings.network' },
  { key: 'about', icon: Info, labelKey: 'settings.about' },
];
```

- [ ] **Step 2: 更新 SettingsPage**

在 `app/settings/page.tsx` 中：

1. 导入 CacheSettings：
```typescript
import CacheSettings from '@/components/settings/CacheSettings';
```

2. 更新 `VALID_TABS`：
```typescript
const VALID_TABS: SettingsTab[] = ['appearance', 'llm', 'tags', 'data', 'cache', 'shortcuts', 'network', 'about'];
```

3. 更新 `tabDescriptions`：
```typescript
const tabDescriptions: Record<SettingsTab, TranslationKey> = {
  // ... 现有条目
  cache: 'settings.cacheDesc',
  // ...
};
```

4. 在 `tabs` 数组中添加：
```typescript
{ key: 'cache', component: <CacheSettings /> },
```

- [ ] **Step 3: 提交**

```bash
git add components/settings/SettingsSidebar.tsx app/settings/page.tsx
git commit -m "feat(cache): 设置页面新增缓存管理 Tab"
```

---

### Task 12: 添加国际化翻译

**Files:**
- Modify: `lib/locales/zh.ts`
- Modify: `lib/locales/en.ts`

- [ ] **Step 1: 添加中文翻译**

在 `lib/locales/zh.ts` 中添加：

```typescript
  // Settings - Cache
  'settings.cache': '缓存管理',
  'settings.cacheDesc': '管理 LLM 响应缓存策略和存储',

  // Cache management
  'cache.stats': '缓存统计',
  'cache.entries': '缓存条目',
  'cache.size': '缓存体积',
  'cache.hits': '命中次数',
  'cache.misses': '未命中次数',
  'cache.hitRate': '命中率',
  'cache.ttl': '有效期',
  'cache.days': '天',
  'cache.operations': '缓存操作',
  'cache.clearAll': '清除全部缓存',
  'cache.clearAllDesc': '删除所有已缓存的 LLM 响应',
  'cache.clearAllConfirm': '确定要清除所有缓存吗？已缓存的生成结果将丢失。',
  'cache.clearExpired': '清除过期缓存',
  'cache.clearExpiredDesc': '仅删除已超过有效期的缓存条目',
  'cache.clearByConfig': '按配置清除',
  'cache.selectConfig': '选择配置...',
  'cache.clearSuccess': '缓存已清除',
  'cache.ttlSettings': '有效期设置',
  'cache.ttlLabel': '缓存有效期',
  'cache.ttlSaved': '有效期已更新',
```

- [ ] **Step 2: 添加英文翻译**

在 `lib/locales/en.ts` 中添加：

```typescript
  // Settings - Cache
  'settings.cache': 'Cache',
  'settings.cacheDesc': 'Manage LLM response cache policy and storage',

  // Cache management
  'cache.stats': 'Cache Statistics',
  'cache.entries': 'Entries',
  'cache.size': 'Size',
  'cache.hits': 'Hits',
  'cache.misses': 'Misses',
  'cache.hitRate': 'Hit Rate',
  'cache.ttl': 'TTL',
  'cache.days': 'days',
  'cache.operations': 'Cache Operations',
  'cache.clearAll': 'Clear All',
  'cache.clearAllDesc': 'Delete all cached LLM responses',
  'cache.clearAllConfirm': 'Are you sure you want to clear all cache? Cached generation results will be lost.',
  'cache.clearExpired': 'Clear Expired',
  'cache.clearExpiredDesc': 'Only delete cache entries that have exceeded their TTL',
  'cache.clearByConfig': 'Clear by Config',
  'cache.selectConfig': 'Select config...',
  'cache.clearSuccess': 'Cache cleared',
  'cache.ttlSettings': 'TTL Settings',
  'cache.ttlLabel': 'Cache TTL',
  'cache.ttlSaved': 'TTL updated',
```

- [ ] **Step 3: 提交**

```bash
git add lib/locales/zh.ts lib/locales/en.ts
git commit -m "feat(cache): 添加缓存管理的国际化翻译"
```

---

### Task 13: 更新 DataSettings 适配新缓存统计

**Files:**
- Modify: `components/settings/DataSettings.tsx`

- [ ] **Step 1: 适配新的 fetchCacheStats 返回格式**

更新 `loadStats` 中的缓存统计获取：

```typescript
const loadStats = useCallback(async () => {
  try {
    const [convResult, configResult, cacheResult] = await Promise.all([
      api.fetchConversationCount(),
      api.fetchConfigs(),
      api.fetchCacheStats(),
    ]);
    setConversationCount(convResult.count);
    setConfigCount(configResult.configs.length);
    setCacheCount(cacheResult.entries);  // 改为 entries
  } catch (err) {
    console.error('Failed to load storage stats:', err);
  } finally {
    setStatsLoading(false);
  }
}, []);
```

- [ ] **Step 2: 提交**

```bash
git add components/settings/DataSettings.tsx
git commit -m "fix(cache): DataSettings 适配新的缓存统计 API 格式"
```

---

### Task 14: 更新文档

**Files:**
- Modify: `docs/features/response-cache.md`

- [ ] **Step 1: 更新缓存文档**

将 `docs/features/response-cache.md` 更新为新的缓存系统文档，包含 L1/L2 分层、缓存键设计、配置感知失效、管理界面等内容。

- [ ] **Step 2: 提交**

```bash
git add docs/features/response-cache.md
git commit -m "docs(cache): 更新响应缓存文档，反映新的 L1/L2 分层架构"
```

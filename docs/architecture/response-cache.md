# LLM 响应缓存

本文档说明 AI Sketch 的 LLM 响应缓存系统架构，包括 L1/L2 分层设计、缓存键生成、淘汰策略和失效机制。

---

## 架构概览

```
┌─────────────────────────────────────────────────┐
│                  Generate Route                  │
│         POST /api/generate (SSE stream)          │
└──────────────┬──────────────────────┬────────────┘
               │                      │
       ┌───────▼───────┐      ┌──────▼──────┐
       │  L1 内存缓存   │      │ CacheManager │
       │  (Map, 50 条)  │      │  (SQLite L2) │
       └───────┬───────┘      └──────┬──────┘
               │ miss                 │ miss
               └──────────┬──────────┘
                          │
                   ┌──────▼──────┐
                   │   调用 LLM   │
                   │  (流式响应)  │
                   └──────┬──────┘
                          │
                   ┌──────▼──────┐
                   │  写入 L1+L2  │
                   └─────────────┘
```

## L1：内存缓存

- **实现**：`lib/cache/memory-cache.ts` — 泛型 `MemoryCache<T>` 类
- **容量**：50 条目，1MB 体积上限
- **淘汰策略**：LRU（最近最少使用）
- **生命周期**：进程重启后清空
- **用途**：热点数据的即时访问，避免频繁 DB 查询

L1 使用 `Map` 的迭代顺序实现 LRU：`get()` 命中时将条目移到末尾，`set()` 超限时淘汰最旧条目。通过 `currentSize` 增量计数避免 O(n) 遍历。

## L2：SQLite 持久缓存

- **实现**：`lib/db/cache-manager.ts` — `CacheManager` 类
- **存储**：`response_cache` 表
- **容量**：100MB 体积上限
- **TTL**：默认 7 天，可通过 `meta` 表的 `cache_ttl_days` 键配置
- **淘汰策略**：LRU（按 `last_used_at` 排序）
- **生命周期**：跨会话持久化

### 淘汰机制

采用高/低水位双阈值策略，避免频繁淘汰抖动：

| 阈值 | 百分比 | 行为 |
|------|--------|------|
| 高水位 | 90%（90MB） | 触发淘汰 |
| 低水位 | 80%（80MB） | 淘汰目标 |

当缓存体积超过高水位时，按 `last_used_at ASC` 批量删除最旧条目，直到体积降至低水位以下。

### 表结构

```sql
CREATE TABLE response_cache (
  id TEXT PRIMARY KEY,              -- 缓存键（SHA-256 哈希，16 位 hex）
  config_name TEXT NOT NULL DEFAULT '',  -- LLM 配置名称
  model TEXT NOT NULL DEFAULT '',        -- AI 模型标识
  response TEXT NOT NULL,           -- 生成的图表代码
  created_at INTEGER NOT NULL,      -- 创建时间（Unix 毫秒）
  last_used_at INTEGER NOT NULL,    -- 最后使用时间（Unix 毫秒）
  use_count INTEGER DEFAULT 1       -- 使用次数
);

CREATE INDEX idx_response_cache_last_used ON response_cache(last_used_at DESC);
CREATE INDEX idx_response_cache_config ON response_cache(config_name, model);
```

## 缓存键生成

**实现**：`lib/cache/cache-key.ts`

缓存键由以下因素组合后取 SHA-256 哈希（前 16 位 hex）：

| 因素 | 说明 |
|------|------|
| `prompt` | 用户输入的描述文本（经策略格式化） |
| `format` | 图表格式（excalidraw / mermaid / drawio） |
| `chartType` | 图表类型（流程图、架构图等） |
| `model` | AI 模型名称 |
| `configName` | LLM 配置名称 |
| `contextHash` | 多轮对话上下文哈希（可选，取最近 6 条消息） |

### 多轮对话支持

`buildContextHash()` 对最近 6 条消息的内容取 SHA-256 哈希（前 8 位 hex），作为缓存键的一部分。这使得多轮对话中的重复请求也能命中缓存，同时避免全量上下文导致命中率过低。

## Inflight 请求去重

`CacheManager.getOrFetch()` 方法实现了 inflight 去重：多个并发请求同一 cacheKey 时，只有第一个请求会实际执行 fetcher（调用 LLM），其余请求等待并共享同一个 Promise 结果。

```typescript
private inflight = new Map<string, Promise<string | null>>();

async getOrFetch(cacheKey, fetcher, metadata) {
  const existing = this.inflight.get(cacheKey);
  if (existing) return existing;  // 复用已有请求

  const promise = (async () => {
    try {
      const cached = await this.get(cacheKey);
      if (cached) return cached;
      const result = await fetcher();
      if (result) await this.set(cacheKey, result, metadata);
      return result;
    } finally {
      this.inflight.delete(cacheKey);  // 清理
    }
  })();

  this.inflight.set(cacheKey, promise);
  return promise;
}
```

## 缓存失效

### 自动失效

| 触发事件 | 失效范围 | 实现位置 |
|----------|----------|----------|
| 删除 LLM 配置 | 该配置相关的所有缓存 | `ConfigManager.deleteConfig()` |
| 更新配置（model 或 name 变更） | 旧配置相关的缓存 | `ConfigManager.updateConfig()` |

失效逻辑在事务外执行（避免 sql.js 事务中的 async 操作），通过 `CacheInvalidator` 调用 `CacheManager.clearByConfig()`。

### 手动失效

通过 **设置 → 缓存管理** UI 或 API 端点：

- `POST /api/cache/clear { type: 'all' }` — 清除全部
- `POST /api/cache/clear { type: 'expired' }` — 清除过期
- `POST /api/cache/clear { type: 'byConfig', configName, model }` — 按配置清除

### L1 清除策略

| 操作 | L1 行为 |
|------|---------|
| `clearAll()` | `l1.clear()` — 全部清空 |
| `clearByConfig()` | `l1.clear()` — 无法按条件过滤，全清 |
| `clearExpired()` | `l1.clear()` — 避免过期条目残留 |

## 命中率统计

- 内存中维护 `hits` / `misses` 计数器
- 每次 `cleanup()` 时持久化到 `meta` 表（`cache_hits` / `cache_misses`）
- `getStats()` 首次调用时自动 `loadStats()` 从 DB 恢复（懒加载）
- 统计数据跨重启保留

## TTL 管理

- 默认 7 天，存储在 `meta` 表的 `cache_ttl_days` 键
- 内存缓存 `ttlCacheMs`，首次查询后缓存，`setTtl()` 时同步更新
- `get()` 和 `cleanup()` 使用缓存值，避免每次查 DB

## 缓存条件

以下条件**不启用缓存**：

1. **图片输入** — 图片 base64 体积大，不缓存
2. **重新生成** — 用户主动点击"重新生成"时跳过缓存

多轮对话**支持缓存**（通过 contextHash 匹配）。

## API 端点

| 端点 | 方法 | 用途 |
|------|------|------|
| `/api/cache/stats` | GET | 获取缓存统计（entries, totalSizeBytes, hits, misses, hitRate, ttlDays） |
| `/api/cache/clear` | POST | 清除缓存（支持 all / expired / byConfig） |
| `/api/cache/ttl` | GET | 获取当前 TTL（天） |
| `/api/cache/ttl` | PUT | 设置 TTL `{ ttlDays: number }` |

## 文件清单

| 文件 | 职责 |
|------|------|
| `lib/cache/memory-cache.ts` | L1 内存缓存（泛型 LRU Map） |
| `lib/cache/cache-key.ts` | 统一缓存键生成 |
| `lib/cache/cache-invalidator.ts` | 配置感知的缓存失效 |
| `lib/db/cache-manager.ts` | L1/L2 协调器，缓存 CRUD |
| `lib/db/index.ts` | 数据库初始化，response_cache 表定义 |
| `lib/db/config-manager.ts` | 配置变更时触发缓存失效 |
| `app/api/generate/route.ts` | 生成路由，集成缓存查找/写入 |
| `app/api/cache/stats/route.ts` | 缓存统计 API |
| `app/api/cache/clear/route.ts` | 缓存清理 API |
| `app/api/cache/ttl/route.ts` | TTL 配置 API |
| `components/settings/CacheSettings.tsx` | 缓存管理 UI |

---

*最后更新：2026-06-09*

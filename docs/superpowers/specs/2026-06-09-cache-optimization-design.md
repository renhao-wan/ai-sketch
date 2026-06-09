# LLM 响应缓存优化设计

**日期**：2026-06-09
**状态**：待审阅
**范围**：ai-sketch 主应用的 LLM 响应缓存系统

## 背景

当前缓存系统存在以下问题：

1. **命中率低**：仅缓存单轮、纯文本、非重新生成的请求，多轮对话完全不缓存
2. **缓存键不一致**：`generate/route.ts` 拼接了 model + configName，但 `cache-manager.ts` 只用 prompt_hash + format + chartType
3. **无性能优化**：每次缓存查询都走 SQLite，无内存缓存层
4. **淘汰策略粗糙**：按条目数（1000 条）淘汰，不考虑实际存储体积
5. **无失效机制**：配置变更/模型切换不影响已缓存的响应
6. **无管理界面**：用户无法查看缓存状态或手动清理
7. **命中率统计缺失**：只有 total 和 avgUseCount，无命中率追踪

## 设计目标

- **提高命中率**：支持多轮对话缓存，统一缓存键生成
- **提升性能**：L1 内存缓存 + L2 SQLite 分层，减少 DB 查询
- **智能失效**：配置变更时自动失效，支持手动管理
- **存储控制**：100MB 体积上限，按体积 LRU 淘汰
- **管理界面**：设置中新增缓存管理面板

**非目标**：
- 不缓存图片输入（体积大，收益低）
- 不引入向量相似度匹配（对桌面应用过重）

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

## 文件结构

| 文件 | 职责 | 类型 |
|------|------|------|
| `lib/cache/memory-cache.ts` | L1 内存缓存（泛型 LRU Map） | 新建 |
| `lib/cache/cache-key.ts` | 统一缓存键生成 | 新建 |
| `lib/cache/cache-invalidator.ts` | 配置变更时的缓存失效 | 新建 |
| `lib/db/cache-manager.ts` | 重构为 L1/L2 协调器 | 重构 |
| `app/api/cache/stats/route.ts` | 缓存统计 API | 新建 |
| `app/api/cache/clear/route.ts` | 缓存清理 API | 新建 |
| `app/api/cache/ttl/route.ts` | TTL 配置 API | 新建 |
| `components/settings/CacheSettings.tsx` | 缓存管理 UI | 新建 |
| `app/api/generate/route.ts` | 集成新缓存系统 | 修改 |
| `app/api/configs/actions/route.ts` | 移除旧的 clear-cache/cache-stats | 修改 |
| `lib/locales/zh.ts` / `en.ts` | 新增翻译键 | 修改 |
| `components/settings/SettingsSidebar.tsx` | 侧边栏新增缓存管理入口 | 修改 |

---

## 缓存键设计

### 统一缓存键生成

```typescript
// lib/cache/cache-key.ts
interface CacheKeyInput {
  prompt: string;           // 用户输入文本
  format: DiagramFormat;    // excalidraw | mermaid | drawio
  chartType: string;        // 流程图、架构图等
  model: string;            // 模型名称
  configName: string;       // 配置名称
  contextHash?: string;     // 多轮对话上下文哈希（可选）
}

function buildCacheKey(input: CacheKeyInput): string {
  const parts = [
    input.prompt,
    input.format,
    input.chartType,
    input.model,
    input.configName,
    input.contextHash ?? '',
  ].join('|');
  return sha256(parts).substring(0, 16);
}
```

### 多轮对话上下文哈希

```typescript
function buildContextHash(messages: LLMMessage[], maxMessages = 6): string {
  const recent = messages.slice(-maxMessages);
  const content = recent.map(m => `${m.role}:${m.content}`).join('\n');
  return sha256(content).substring(0, 8);
}
```

### 缓存键包含的因素

| 因素 | 包含原因 |
|------|----------|
| prompt | 核心输入 |
| format | 不同格式输出完全不同 |
| chartType | 图表类型影响 prompt 和输出 |
| model | 不同模型对同一 prompt 输出不同 |
| configName | 同模型不同配置输出不同 |
| contextHash | 多轮对话的上下文影响输出 |

---

## L1 内存缓存

```typescript
// lib/cache/memory-cache.ts
class MemoryCache<T> {
  private cache = new Map<string, { value: T; size: number }>();
  private totalSize = 0;
  private readonly maxEntries: number;   // 50
  private readonly maxSizeBytes: number; // 1MB

  get(key: string): T | null { ... }    // 命中时移到末尾（LRU）
  set(key: string, value: T): void { ... } // 超限时淘汰最旧
  delete(key: string): void { ... }
  clear(): void { ... }
  has(key: string): boolean { ... }
}
```

**L1 参数**：

| 参数 | 值 | 说明 |
|------|-----|------|
| 最大条目数 | 50 | 热点缓存，不占太多内存 |
| 最大体积 | 1MB | 防止单条大响应占满内存 |
| 淘汰策略 | LRU | 最久未访问的优先淘汰 |
| TTL | 继承 L2 | L1 不独立设 TTL，L2 过期时同步清除 L1 |

---

## L2 SQLite 缓存

保持现有 `response_cache` 表结构，新增列并修改淘汰策略。

### Schema 变更

```sql
-- 新增列
ALTER TABLE response_cache ADD COLUMN config_name TEXT NOT NULL DEFAULT '';
ALTER TABLE response_cache ADD COLUMN model TEXT NOT NULL DEFAULT '';

-- 新增索引
CREATE INDEX IF NOT EXISTS idx_response_cache_config ON response_cache(config_name, model);
```

### 参数变更

| 参数 | 当前 | 优化后 |
|------|------|--------|
| 最大条目数 | 1000 | 移除（改为体积限制） |
| 最大体积 | 无限制 | 100MB |
| TTL | 7 天（硬编码） | 可配置（默认 7 天） |
| 淘汰策略 | LRU（条目数） | LRU（体积） |

### 体积淘汰逻辑

```typescript
async private cleanup(): Promise<void> {
  const db = await getDb();
  const now = Date.now();

  // 1. 删除过期条目
  db.run('DELETE FROM response_cache WHERE created_at < ?', [now - this.ttl]);

  // 2. 检查总体积
  const result = db.exec('SELECT COALESCE(SUM(LENGTH(response)), 0) FROM response_cache');
  const totalSize = result[0]?.values[0]?.[0] as number ?? 0;

  if (totalSize > this.maxSizeBytes) {
    // 3. 按 last_used_at 升序删除，直到体积低于限制
    // 使用迭代删除，每次删除最旧的一批
    while (totalSize > this.maxSizeBytes * 0.9) {
      const deleted = db.run(`
        DELETE FROM response_cache WHERE id IN (
          SELECT id FROM response_cache ORDER BY last_used_at ASC LIMIT 10
        )
      `);
      if (deleted.changes === 0) break;
      // 重新计算体积...
    }
  }
}
```

---

## 缓存穿透保护

同一个 cacheKey 短时间内被多个并发请求命中时，避免重复调用 LLM：

```typescript
private inflightRequests = new Map<string, Promise<string>>();

async getOrFetch(
  key: string,
  fetcher: () => Promise<string>,
): Promise<string> {
  // 1. 查 L1
  const l1 = this.l1.get(key);
  if (l1) return l1;

  // 2. 查 L2
  const l2 = await this.l2.get(key);
  if (l2) { this.l1.set(key, l2); return l2; }

  // 3. 检查是否有进行中的请求
  const inflight = this.inflightRequests.get(key);
  if (inflight) return inflight;

  // 4. 发起新请求
  const promise = fetcher().then(result => {
    this.set(key, result);
    this.inflightRequests.delete(key);
    return result;
  });
  this.inflightRequests.set(key, promise);
  return promise;
}
```

---

## 缓存失效机制

### 自动失效

| 触发事件 | 失效范围 |
|----------|----------|
| 删除配置 | 该配置相关的所有缓存（WHERE config_name = ? AND model = ?） |
| 更新配置（模型/名称变更） | 旧配置相关的缓存 |
| 切换活跃配置 | 不失效 |
| 更新代理设置 | 不影响缓存 |

### 实现

```typescript
// lib/cache/cache-invalidator.ts
class CacheInvalidator {
  constructor(private l1: MemoryCache<string>) {}

  async invalidateByConfig(configName: string, model: string): Promise<number> {
    const db = await getDb();
    db.run(
      'DELETE FROM response_cache WHERE config_name = ? AND model = ?',
      [configName, model],
    );
    // 清除 L1 中可能相关的条目（L1 无法按条件清除，直接全清）
    this.l1.clear();
    requestSave();
    return db.getRowsModified();
  }

  async invalidateAll(): Promise<void> {
    const db = await getDb();
    db.run('DELETE FROM response_cache');
    this.l1.clear();
    requestSave();
  }

  async invalidateExpired(): Promise<number> {
    const db = await getDb();
    const ttl = await this.getTtl();
    db.run('DELETE FROM response_cache WHERE created_at < ?', [Date.now() - ttl]);
    this.l1.clear();
    requestSave();
    return db.getRowsModified();
  }
}
```

### 集成点

- `ConfigManager.deleteConfig()` → 调用 `invalidator.invalidateByConfig()`
- `ConfigManager.updateConfig()` → 检测 model/name 变更时调用 `invalidator.invalidateByConfig()`

---

## 命中率统计

```typescript
// 在 CacheManager 中新增
private stats = { hits: 0, misses: 0 };

async get(key: string): Promise<string | null> {
  // ... L1/L2 查找
  if (found) { this.stats.hits++; return found; }
  this.stats.misses++;
  return null;
}

getHitRate(): number {
  const total = this.stats.hits + this.stats.misses;
  return total > 0 ? this.stats.hits / total : 0;
}
```

统计持久化到 SQLite 的 `meta` 表：
- `cache_hits` — 累计命中次数
- `cache_misses` — 累计未命中次数
- 重启后从 DB 恢复，继续累加

---

## 流式输出优化

缓存命中时的模拟流式输出从 50 字符/块 改为 100 字符/块 + 10ms 延迟：

```typescript
async function streamCachedResponse(
  controller: ReadableStreamDefaultController,
  code: string,
): Promise<void> {
  const encoder = new TextEncoder();
  const chunkSize = 100;
  const delayMs = 10;

  for (let i = 0; i < code.length; i += chunkSize) {
    const chunk = code.substring(i, i + chunkSize);
    const data = `data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`;
    controller.enqueue(encoder.encode(data));
    await new Promise(r => setTimeout(r, delayMs));
  }
}
```

---

## 缓存管理 API

### GET /api/cache/stats

返回缓存统计信息：

```json
{
  "entries": 127,
  "totalSizeBytes": 2400000,
  "hits": 89,
  "misses": 34,
  "hitRate": 0.72,
  "ttlDays": 7
}
```

### POST /api/cache/clear

请求体：

```json
{ "type": "all" }
// 或
{ "type": "expired" }
// 或
{ "type": "byConfig", "configName": "my-config", "model": "gpt-4" }
```

### GET /api/cache/ttl

返回当前 TTL 配置：

```json
{ "ttlDays": 7 }
```

### PUT /api/cache/ttl

更新 TTL 配置：

```json
{ "ttlDays": 14 }
```

TTL 存储在 SQLite `meta` 表中，键为 `cache_ttl_days`。

---

## 缓存管理 UI

在设置页面新增「缓存管理」tab，放在「数据管理」下面。

### 界面布局

```
┌─────────────────────────────────────────────────┐
│  缓存管理                                        │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌─ 统计卡片 ──────────────────────────────────┐ │
│  │  缓存条目: 127 条    缓存体积: 2.3MB         │ │
│  │  命中次数: 89 次     命中率: 73%             │ │
│  │  平均响应: 1.2KB     TTL: 7 天              │ │
│  └──────────────────────────────────────────────┘ │
│                                                  │
│  ┌─ 操作区 ────────────────────────────────────┐ │
│  │  [清除全部缓存]  [清除过期缓存]              │ │
│  └──────────────────────────────────────────────┘ │
│                                                  │
│  ┌─ 按配置清理 ────────────────────────────────┐ │
│  │  配置: [下拉选择]  模型: [自动填充]          │ │
│  │  该配置缓存: 23 条  [清除该配置缓存]         │ │
│  └──────────────────────────────────────────────┘ │
│                                                  │
│  ┌─ TTL 设置 ──────────────────────────────────┐ │
│  │  缓存有效期: [7] 天  [保存]                  │ │
│  └──────────────────────────────────────────────┘ │
│                                                  │
└─────────────────────────────────────────────────┘
```

### 侧边栏位置

`SettingsSidebar` 中的顺序：外观 → LLM → 会话 → 标签 → 快捷键 → 数据 → **缓存** → 网络 → 关于

---

## 国际化

新增翻译键：

| 键 | 中文 | 英文 |
|----|------|------|
| `settings.cache` | 缓存管理 | Cache |
| `cache.entries` | 缓存条目 | Entries |
| `cache.size` | 缓存体积 | Size |
| `cache.hits` | 命中次数 | Hits |
| `cache.misses` | 未命中次数 | Misses |
| `cache.hitRate` | 命中率 | Hit Rate |
| `cache.ttl` | 有效期 | TTL |
| `cache.ttlDays` | 缓存有效期（天） | Cache TTL (days) |
| `cache.clearAll` | 清除全部缓存 | Clear All |
| `cache.clearExpired` | 清除过期缓存 | Clear Expired |
| `cache.clearByConfig` | 按配置清除 | Clear by Config |
| `cache.clearSuccess` | 缓存已清除 | Cache cleared |
| `cache.clearConfirm` | 确认清除所有缓存？ | Clear all cache? |
| `cache.configLabel` | 选择配置 | Select config |
| `cache.modelLabel` | 模型 | Model |
| `cache.configEntries` | 该配置缓存条目 | Config cache entries |

---

## 生成路由集成

`app/api/generate/route.ts` 的核心变更：

1. **缓存键构建**：使用新的 `buildCacheKey()` 统一生成
2. **缓存查找**：使用 `cacheManager.getOrFetch()` 统一处理 L1/L2/穿透
3. **缓存写入**：流结束后调用 `cacheManager.set()`，传入 configName 和 model
4. **流式输出**：缓存命中时使用新的 `streamCachedResponse()` 函数
5. **条件不变**：仍然只对非图片、非重新生成的请求启用缓存

**多轮对话缓存条件**：
- 当前：仅 `contextMessages.length <= 2` 时缓存
- 优化后：移除此限制，通过 contextHash 支持多轮缓存
- 但仍然排除图片输入和重新生成

---

## 依赖关系

```
cache-key.ts          ← 无依赖，纯函数
memory-cache.ts       ← 无依赖，泛型工具
cache-invalidator.ts  ← 依赖 memory-cache、db/index、db/config-manager
cache-manager.ts      ← 依赖 memory-cache、cache-key、cache-invalidator、db/index
generate/route.ts     ← 依赖 cache-manager、cache-key
CacheSettings.tsx     ← 依赖 api/client、locales
```

---

## 迁移策略

1. **Schema 迁移**：`response_cache` 表新增 `config_name` 和 `model` 列，使用 `ALTER TABLE ... ADD COLUMN`（向后兼容）
2. **存量数据**：旧缓存的 `config_name` 和 `model` 为空字符串，不会被按配置失效命中，7 天后自然过期
3. **缓存键变更**：旧缓存键不含 model/configName，新缓存键包含。旧缓存不会被新查询命中，等效于缓存预热

---

*最后更新：2026-06-09*

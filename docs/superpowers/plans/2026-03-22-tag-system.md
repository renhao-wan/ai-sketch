# 标签系统实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为对话和 LLM 配置添加标签系统，支持分类管理、筛选过滤和批量操作

**Architecture:** 独立标签池设计，对话标签和配置标签分开管理。数据库层使用关联表实现多对多关系，API 层提供 CRUD 和筛选接口，UI 层包含设置页标签管理和列表集成。

**Tech Stack:** Next.js 16 (App Router) + React 19 + TypeScript + SQLite (sql.js WASM) + Tailwind CSS v4 + lucide-react

---

## 文件结构

### 新增文件

| 文件 | 职责 |
|------|------|
| `lib/db/tag-manager.ts` | 标签数据访问层，管理标签 CRUD 和关联操作 |
| `app/api/conversation-tags/route.ts` | 对话标签 API (GET, POST) |
| `app/api/conversation-tags/[id]/route.ts` | 对话标签 API (PUT, DELETE) |
| `app/api/config-tags/route.ts` | 配置标签 API (GET, POST) |
| `app/api/config-tags/[id]/route.ts` | 配置标签 API (PUT, DELETE) |
| `app/api/conversations/[id]/tags/route.ts` | 对话标签关联 API (PUT) |
| `app/api/configs/[id]/tags/route.ts` | 配置标签关联 API (PUT) |
| `components/ui/TagBadge.tsx` | 标签胶囊组件 |
| `components/ui/TagCloudSelector.tsx` | 标签云选择器组件 |
| `components/ui/TagFilter.tsx` | 标签筛选器组件 |
| `components/settings/TagSettings.tsx` | 设置页标签管理 |

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `lib/db/index.ts` | 添加标签相关表的创建语句 |
| `lib/types/index.ts` | 添加 ConversationTag 和 ConfigTag 类型 |
| `lib/locales/zh.ts` | 添加标签相关中文翻译 |
| `lib/locales/en.ts` | 添加标签相关英文翻译 |
| `lib/api/client.ts` | 添加标签 API 客户端函数 |
| `components/settings/SettingsSidebar.tsx` | 添加标签管理标签页 |
| `app/settings/page.tsx` | 集成标签管理组件 |
| `components/ai/ConversationList.tsx` | 集成标签显示和筛选 |
| `components/settings/LLMSettings.tsx` | 集成标签显示和筛选 |

---

## Task 1: 数据库层 — 类型定义和表创建

**Files:**
- Modify: `lib/types/index.ts`
- Modify: `lib/db/index.ts`

- [ ] **Step 1: 添加标签类型定义**

在 `lib/types/index.ts` 末尾添加：

```typescript
/** 对话标签 */
export interface ConversationTag {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

/** 配置标签 */
export interface ConfigTag {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}
```

- [ ] **Step 2: 添加标签表创建语句**

在 `lib/db/index.ts` 的 `initDb()` 函数中，在 `response_cache` 表创建之后添加：

```typescript
// 标签表
db.run(`
  CREATE TABLE IF NOT EXISTS conversation_tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#6366f1',
    created_at INTEGER NOT NULL
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS config_tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#6366f1',
    created_at INTEGER NOT NULL
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS conversation_tag_relations (
    conversation_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    PRIMARY KEY (conversation_id, tag_id),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES conversation_tags(id) ON DELETE CASCADE
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS config_tag_relations (
    config_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    PRIMARY KEY (config_id, tag_id),
    FOREIGN KEY (config_id) REFERENCES llm_configs(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES config_tags(id) ON DELETE CASCADE
  )
`);

db.run('CREATE INDEX IF NOT EXISTS idx_conversation_tag_relations_tag ON conversation_tag_relations(tag_id)');
db.run('CREATE INDEX IF NOT EXISTS idx_config_tag_relations_tag ON config_tag_relations(tag_id)');
```

- [ ] **Step 3: 验证数据库表创建**

运行开发服务器，检查数据库是否正常初始化：

```bash
cd d:/python/PycharmProjects/ai-sketch-project/ai-sketch
pnpm dev
```

访问 `http://localhost:3000` 确认无错误。

- [ ] **Step 4: 提交**

```bash
git add lib/types/index.ts lib/db/index.ts
git commit -m "feat(db): 添加标签系统数据库表和类型定义"
```

---

## Task 2: 数据访问层 — TagManager

**Files:**
- Create: `lib/db/tag-manager.ts`

- [ ] **Step 1: 创建 TagManager 类**

创建 `lib/db/tag-manager.ts`：

```typescript
import { getDb, requestSave } from './index';
import { withTransaction } from './transaction';
import { generateId } from '@/lib/utils';
import type { ConversationTag, ConfigTag, Conversation, LLMConfig } from '@/lib/types';

/** 将数据库行转换为 ConversationTag */
function rowToConversationTag(row: Record<string, unknown>): ConversationTag {
  return {
    id: row.id as string,
    name: row.name as string,
    color: row.color as string,
    createdAt: row.created_at as number,
  };
}

/** 将数据库行转换为 ConfigTag */
function rowToConfigTag(row: Record<string, unknown>): ConfigTag {
  return {
    id: row.id as string,
    name: row.name as string,
    color: row.color as string,
    createdAt: row.created_at as number,
  };
}

class TagManager {
  private generateId = generateId;

  // ==================== 对话标签 ====================

  /** 获取所有对话标签 */
  async getConversationTags(): Promise<ConversationTag[]> {
    const db = await getDb();
    const stmt = db.prepare('SELECT * FROM conversation_tags ORDER BY created_at DESC');
    const tags: ConversationTag[] = [];
    try {
      while (stmt.step()) {
        tags.push(rowToConversationTag(stmt.getAsObject() as Record<string, unknown>));
      }
    } finally {
      stmt.free();
    }
    return tags;
  }

  /** 创建对话标签 */
  async createConversationTag(data: { name: string; color: string }): Promise<ConversationTag> {
    const db = await getDb();
    const id = this.generateId();
    const now = Date.now();

    db.run(
      'INSERT INTO conversation_tags (id, name, color, created_at) VALUES (?, ?, ?, ?)',
      [id, data.name, data.color, now],
    );
    requestSave();

    return { id, name: data.name, color: data.color, createdAt: now };
  }

  /** 更新对话标签 */
  async updateConversationTag(id: string, data: { name?: string; color?: string }): Promise<ConversationTag> {
    const db = await getDb();
    const existing = db.exec('SELECT * FROM conversation_tags WHERE id = ?', [id]);
    if (existing.length === 0 || existing[0].values.length === 0) {
      throw new Error('标签不存在');
    }

    const row = existing[0].values[0];
    const current = {
      id: row[0] as string,
      name: row[1] as string,
      color: row[2] as string,
      createdAt: row[3] as number,
    };

    const updated = {
      ...current,
      name: data.name ?? current.name,
      color: data.color ?? current.color,
    };

    db.run(
      'UPDATE conversation_tags SET name = ?, color = ? WHERE id = ?',
      [updated.name, updated.color, id],
    );
    requestSave();

    return updated;
  }

  /** 删除对话标签 */
  async deleteConversationTag(id: string): Promise<void> {
    const db = await getDb();
    withTransaction(db, () => {
      db.run('DELETE FROM conversation_tag_relations WHERE tag_id = ?', [id]);
      db.run('DELETE FROM conversation_tags WHERE id = ?', [id]);
    });
  }

  /** 设置对话标签（替换） */
  async setConversationTags(conversationId: string, tagIds: string[]): Promise<void> {
    const db = await getDb();
    withTransaction(db, () => {
      db.run('DELETE FROM conversation_tag_relations WHERE conversation_id = ?', [conversationId]);
      for (const tagId of tagIds) {
        db.run(
          'INSERT INTO conversation_tag_relations (conversation_id, tag_id) VALUES (?, ?)',
          [conversationId, tagId],
        );
      }
    });
  }

  /** 获取对话的标签 */
  async getConversationTagsByIds(conversationId: string): Promise<ConversationTag[]> {
    const db = await getDb();
    const stmt = db.prepare(`
      SELECT t.* FROM conversation_tags t
      INNER JOIN conversation_tag_relations r ON t.id = r.tag_id
      WHERE r.conversation_id = ?
      ORDER BY t.created_at DESC
    `);
    const tags: ConversationTag[] = [];
    try {
      stmt.bind([conversationId]);
      while (stmt.step()) {
        tags.push(rowToConversationTag(stmt.getAsObject() as Record<string, unknown>));
      }
    } finally {
      stmt.free();
    }
    return tags;
  }

  /** 按标签获取对话 */
  async getConversationsByTag(tagId: string): Promise<Conversation[]> {
    const db = await getDb();
    const stmt = db.prepare(`
      SELECT c.* FROM conversations c
      INNER JOIN conversation_tag_relations r ON c.id = r.conversation_id
      WHERE r.tag_id = ?
      ORDER BY c.updated_at DESC
    `);
    const conversations: Conversation[] = [];
    try {
      stmt.bind([tagId]);
      while (stmt.step()) {
        const row = stmt.getAsObject() as Record<string, unknown>;
        conversations.push({
          id: row.id as string,
          title: row.title as string,
          chartType: row.chart_type as string,
          format: (row.format as string) || 'excalidraw',
          configName: (row.config_name as string) || undefined,
          configModel: (row.config_model as string) || undefined,
          currentCode: row.current_code as string,
          messageCount: row.message_count as number,
          createdAt: row.created_at as number,
          updatedAt: row.updated_at as number,
        });
      }
    } finally {
      stmt.free();
    }
    return conversations;
  }

  // ==================== 配置标签 ====================

  /** 获取所有配置标签 */
  async getConfigTags(): Promise<ConfigTag[]> {
    const db = await getDb();
    const stmt = db.prepare('SELECT * FROM config_tags ORDER BY created_at DESC');
    const tags: ConfigTag[] = [];
    try {
      while (stmt.step()) {
        tags.push(rowToConfigTag(stmt.getAsObject() as Record<string, unknown>));
      }
    } finally {
      stmt.free();
    }
    return tags;
  }

  /** 创建配置标签 */
  async createConfigTag(data: { name: string; color: string }): Promise<ConfigTag> {
    const db = await getDb();
    const id = this.generateId();
    const now = Date.now();

    db.run(
      'INSERT INTO config_tags (id, name, color, created_at) VALUES (?, ?, ?, ?)',
      [id, data.name, data.color, now],
    );
    requestSave();

    return { id, name: data.name, color: data.color, createdAt: now };
  }

  /** 更新配置标签 */
  async updateConfigTag(id: string, data: { name?: string; color?: string }): Promise<ConfigTag> {
    const db = await getDb();
    const existing = db.exec('SELECT * FROM config_tags WHERE id = ?', [id]);
    if (existing.length === 0 || existing[0].values.length === 0) {
      throw new Error('标签不存在');
    }

    const row = existing[0].values[0];
    const current = {
      id: row[0] as string,
      name: row[1] as string,
      color: row[2] as string,
      createdAt: row[3] as number,
    };

    const updated = {
      ...current,
      name: data.name ?? current.name,
      color: data.color ?? current.color,
    };

    db.run(
      'UPDATE config_tags SET name = ?, color = ? WHERE id = ?',
      [updated.name, updated.color, id],
    );
    requestSave();

    return updated;
  }

  /** 删除配置标签 */
  async deleteConfigTag(id: string): Promise<void> {
    const db = await getDb();
    withTransaction(db, () => {
      db.run('DELETE FROM config_tag_relations WHERE tag_id = ?', [id]);
      db.run('DELETE FROM config_tags WHERE id = ?', [id]);
    });
  }

  /** 设置配置标签（替换） */
  async setConfigTags(configId: string, tagIds: string[]): Promise<void> {
    const db = await getDb();
    withTransaction(db, () => {
      db.run('DELETE FROM config_tag_relations WHERE config_id = ?', [configId]);
      for (const tagId of tagIds) {
        db.run(
          'INSERT INTO config_tag_relations (config_id, tag_id) VALUES (?, ?)',
          [configId, tagId],
        );
      }
    });
  }

  /** 获取配置的标签 */
  async getConfigTagsByIds(configId: string): Promise<ConfigTag[]> {
    const db = await getDb();
    const stmt = db.prepare(`
      SELECT t.* FROM config_tags t
      INNER JOIN config_tag_relations r ON t.id = r.tag_id
      WHERE r.config_id = ?
      ORDER BY t.created_at DESC
    `);
    const tags: ConfigTag[] = [];
    try {
      stmt.bind([configId]);
      while (stmt.step()) {
        tags.push(rowToConfigTag(stmt.getAsObject() as Record<string, unknown>));
      }
    } finally {
      stmt.free();
    }
    return tags;
  }

  /** 按标签获取配置 */
  async getConfigsByTag(tagId: string): Promise<LLMConfig[]> {
    const db = await getDb();
    const stmt = db.prepare(`
      SELECT c.* FROM llm_configs c
      INNER JOIN config_tag_relations r ON c.id = r.config_id
      WHERE r.tag_id = ?
      ORDER BY c.created_at DESC
    `);
    const configs: LLMConfig[] = [];
    try {
      stmt.bind([tagId]);
      while (stmt.step()) {
        const row = stmt.getAsObject() as Record<string, unknown>;
        configs.push({
          id: row.id as string,
          name: row.name as string,
          type: row.type as 'openai' | 'anthropic' | 'ollama',
          baseUrl: row.base_url as string,
          apiKey: row.api_key as string,
          model: row.model as string,
          description: row.description as string,
          isActive: (row.is_active as number) === 1,
          temperature: (row.temperature as number) ?? 0.5,
          maxTokens: row.max_tokens as number,
          createdAt: row.created_at as number,
          updatedAt: row.updated_at as number,
        });
      }
    } finally {
      stmt.free();
    }
    return configs;
  }
}

export const tagManager = new TagManager();
export default TagManager;
```

- [ ] **Step 2: 验证导入无错误**

运行 TypeScript 检查：

```bash
cd d:/python/PycharmProjects/ai-sketch-project/ai-sketch
pnpm lint
```

确认无错误。

- [ ] **Step 3: 提交**

```bash
git add lib/db/tag-manager.ts
git commit -m "feat(db): 实现 TagManager 数据访问层"
```

---

## Task 3: API 层 — 对话标签 API

**Files:**
- Create: `app/api/conversation-tags/route.ts`
- Create: `app/api/conversation-tags/[id]/route.ts`

- [ ] **Step 1: 创建对话标签列表 API**

创建 `app/api/conversation-tags/route.ts`：

```typescript
import { NextResponse } from 'next/server';
import { tagManager } from '@/lib/db/tag-manager';

/**
 * GET /api/conversation-tags
 * 获取所有对话标签
 */
export async function GET() {
  try {
    const tags = await tagManager.getConversationTags();
    return NextResponse.json({ tags });
  } catch (error) {
    console.error('Error fetching conversation tags:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * POST /api/conversation-tags
 * 创建对话标签
 * Body: { name: string; color: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, color } = body;

    if (!name || !color) {
      return NextResponse.json({ error: '缺少必填参数: name, color' }, { status: 400 });
    }

    if (name.length > 20) {
      return NextResponse.json({ error: '标签名称不能超过 20 个字符' }, { status: 400 });
    }

    const tag = await tagManager.createConversationTag({ name, color });
    return NextResponse.json(tag);
  } catch (error) {
    console.error('Error creating conversation tag:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
```

- [ ] **Step 2: 创建对话标签单个操作 API**

创建 `app/api/conversation-tags/[id]/route.ts`：

```typescript
import { NextResponse } from 'next/server';
import { tagManager } from '@/lib/db/tag-manager';

/**
 * PUT /api/conversation-tags/:id
 * 更新对话标签
 * Body: { name?: string; color?: string }
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, color } = body;

    if (name !== undefined && name.length > 20) {
      return NextResponse.json({ error: '标签名称不能超过 20 个字符' }, { status: 400 });
    }

    const tag = await tagManager.updateConversationTag(id, { name, color });
    return NextResponse.json(tag);
  } catch (error) {
    console.error('Error updating conversation tag:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * DELETE /api/conversation-tags/:id
 * 删除对话标签
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await tagManager.deleteConversationTag(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting conversation tag:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
```

- [ ] **Step 3: 验证 API 路由**

运行开发服务器并测试：

```bash
cd d:/python/PycharmProjects/ai-sketch-project/ai-sketch
pnpm dev
```

使用 curl 或浏览器测试：

```bash
# 获取标签列表
curl http://localhost:3000/api/conversation-tags

# 创建标签
curl -X POST http://localhost:3000/api/conversation-tags \
  -H "Content-Type: application/json" \
  -d '{"name":"测试","color":"#6366f1"}'
```

- [ ] **Step 4: 提交**

```bash
git add app/api/conversation-tags/
git commit -m "feat(api): 实现对话标签 API"
```

---

## Task 4: API 层 — 配置标签 API

**Files:**
- Create: `app/api/config-tags/route.ts`
- Create: `app/api/config-tags/[id]/route.ts`

- [ ] **Step 1: 创建配置标签列表 API**

创建 `app/api/config-tags/route.ts`：

```typescript
import { NextResponse } from 'next/server';
import { tagManager } from '@/lib/db/tag-manager';

/**
 * GET /api/config-tags
 * 获取所有配置标签
 */
export async function GET() {
  try {
    const tags = await tagManager.getConfigTags();
    return NextResponse.json({ tags });
  } catch (error) {
    console.error('Error fetching config tags:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * POST /api/config-tags
 * 创建配置标签
 * Body: { name: string; color: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, color } = body;

    if (!name || !color) {
      return NextResponse.json({ error: '缺少必填参数: name, color' }, { status: 400 });
    }

    if (name.length > 20) {
      return NextResponse.json({ error: '标签名称不能超过 20 个字符' }, { status: 400 });
    }

    const tag = await tagManager.createConfigTag({ name, color });
    return NextResponse.json(tag);
  } catch (error) {
    console.error('Error creating config tag:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
```

- [ ] **Step 2: 创建配置标签单个操作 API**

创建 `app/api/config-tags/[id]/route.ts`：

```typescript
import { NextResponse } from 'next/server';
import { tagManager } from '@/lib/db/tag-manager';

/**
 * PUT /api/config-tags/:id
 * 更新配置标签
 * Body: { name?: string; color?: string }
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, color } = body;

    if (name !== undefined && name.length > 20) {
      return NextResponse.json({ error: '标签名称不能超过 20 个字符' }, { status: 400 });
    }

    const tag = await tagManager.updateConfigTag(id, { name, color });
    return NextResponse.json(tag);
  } catch (error) {
    console.error('Error updating config tag:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * DELETE /api/config-tags/:id
 * 删除配置标签
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await tagManager.deleteConfigTag(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting config tag:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
```

- [ ] **Step 3: 验证 API 路由**

运行开发服务器并测试：

```bash
# 获取标签列表
curl http://localhost:3000/api/config-tags

# 创建标签
curl -X POST http://localhost:3000/api/config-tags \
  -H "Content-Type: application/json" \
  -d '{"name":"工作","color":"#22c55e"}'
```

- [ ] **Step 4: 提交**

```bash
git add app/api/config-tags/
git commit -m "feat(api): 实现配置标签 API"
```

---

## Task 5: API 层 — 标签关联 API

**Files:**
- Create: `app/api/conversations/[id]/tags/route.ts`
- Create: `app/api/configs/[id]/tags/route.ts`

- [ ] **Step 1: 创建对话标签关联 API**

创建 `app/api/conversations/[id]/tags/route.ts`：

```typescript
import { NextResponse } from 'next/server';
import { tagManager } from '@/lib/db/tag-manager';

/**
 * PUT /api/conversations/:id/tags
 * 设置对话标签（替换）
 * Body: { tagIds: string[] }
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { tagIds } = body;

    if (!Array.isArray(tagIds)) {
      return NextResponse.json({ error: 'tagIds 必须是数组' }, { status: 400 });
    }

    if (tagIds.length > 10) {
      return NextResponse.json({ error: '每个对话最多 10 个标签' }, { status: 400 });
    }

    await tagManager.setConversationTags(id, tagIds);
    const tags = await tagManager.getConversationTagsByIds(id);
    return NextResponse.json({ tags });
  } catch (error) {
    console.error('Error setting conversation tags:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * GET /api/conversations/:id/tags
 * 获取对话标签
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const tags = await tagManager.getConversationTagsByIds(id);
    return NextResponse.json({ tags });
  } catch (error) {
    console.error('Error fetching conversation tags:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
```

- [ ] **Step 2: 创建配置标签关联 API**

创建 `app/api/configs/[id]/tags/route.ts`：

```typescript
import { NextResponse } from 'next/server';
import { tagManager } from '@/lib/db/tag-manager';

/**
 * PUT /api/configs/:id/tags
 * 设置配置标签（替换）
 * Body: { tagIds: string[] }
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { tagIds } = body;

    if (!Array.isArray(tagIds)) {
      return NextResponse.json({ error: 'tagIds 必须是数组' }, { status: 400 });
    }

    if (tagIds.length > 10) {
      return NextResponse.json({ error: '每个配置最多 10 个标签' }, { status: 400 });
    }

    await tagManager.setConfigTags(id, tagIds);
    const tags = await tagManager.getConfigTagsByIds(id);
    return NextResponse.json({ tags });
  } catch (error) {
    console.error('Error setting config tags:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * GET /api/configs/:id/tags
 * 获取配置标签
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const tags = await tagManager.getConfigTagsByIds(id);
    return NextResponse.json({ tags });
  } catch (error) {
    console.error('Error fetching config tags:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
```

- [ ] **Step 3: 验证 API 路由**

测试关联操作：

```bash
# 设置对话标签（需要先创建标签和对话）
curl -X PUT http://localhost:3000/api/conversations/对话ID/tags \
  -H "Content-Type: application/json" \
  -d '{"tagIds":["标签ID1","标签ID2"]}'

# 获取对话标签
curl http://localhost:3000/api/conversations/对话ID/tags
```

- [ ] **Step 4: 提交**

```bash
git add app/api/conversations/[id]/tags/ app/api/configs/[id]/tags/
git commit -m "feat(api): 实现标签关联 API"
```

---

## Task 6: API 客户端 — 添加标签 API 函数

**Files:**
- Modify: `lib/api/client.ts`

- [ ] **Step 1: 添加标签 API 客户端函数**

在 `lib/api/client.ts` 末尾添加：

```typescript
// ── Tag operations ──

import type { ConversationTag, ConfigTag } from '@/lib/types';

/** 获取所有对话标签 */
export async function fetchConversationTags(): Promise<ConversationTag[]> {
  const data = await request<{ tags: ConversationTag[] }>('/api/conversation-tags');
  return data.tags;
}

/** 创建对话标签 */
export async function createConversationTag(data: { name: string; color: string }): Promise<ConversationTag> {
  return request('/api/conversation-tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/** 更新对话标签 */
export async function updateConversationTag(id: string, data: { name?: string; color?: string }): Promise<ConversationTag> {
  return request(`/api/conversation-tags/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/** 删除对话标签 */
export async function deleteConversationTag(id: string): Promise<void> {
  await request<{ success: boolean }>(`/api/conversation-tags/${id}`, { method: 'DELETE' });
}

/** 设置对话标签 */
export async function setConversationTags(conversationId: string, tagIds: string[]): Promise<{ tags: ConversationTag[] }> {
  return request(`/api/conversations/${conversationId}/tags`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tagIds }),
  });
}

/** 获取对话标签 */
export async function fetchConversationTagsByIds(conversationId: string): Promise<ConversationTag[]> {
  const data = await request<{ tags: ConversationTag[] }>(`/api/conversations/${conversationId}/tags`);
  return data.tags;
}

/** 获取所有配置标签 */
export async function fetchConfigTags(): Promise<ConfigTag[]> {
  const data = await request<{ tags: ConfigTag[] }>('/api/config-tags');
  return data.tags;
}

/** 创建配置标签 */
export async function createConfigTag(data: { name: string; color: string }): Promise<ConfigTag> {
  return request('/api/config-tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/** 更新配置标签 */
export async function updateConfigTag(id: string, data: { name?: string; color?: string }): Promise<ConfigTag> {
  return request(`/api/config-tags/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/** 删除配置标签 */
export async function deleteConfigTag(id: string): Promise<void> {
  await request<{ success: boolean }>(`/api/config-tags/${id}`, { method: 'DELETE' });
}

/** 设置配置标签 */
export async function setConfigTags(configId: string, tagIds: string[]): Promise<{ tags: ConfigTag[] }> {
  return request(`/api/configs/${configId}/tags`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tagIds }),
  });
}

/** 获取配置标签 */
export async function fetchConfigTagsByIds(configId: string): Promise<ConfigTag[]> {
  const data = await request<{ tags: ConfigTag[] }>(`/api/configs/${configId}/tags`);
  return data.tags;
}
```

- [ ] **Step 2: 验证导入**

运行 TypeScript 检查：

```bash
cd d:/python/PycharmProjects/ai-sketch-project/ai-sketch
pnpm lint
```

- [ ] **Step 3: 提交**

```bash
git add lib/api/client.ts
git commit -m "feat(api): 添加标签 API 客户端函数"
```

---

## Task 7: 国际化 — 添加标签相关翻译

**Files:**
- Modify: `lib/locales/zh.ts`
- Modify: `lib/locales/en.ts`

- [ ] **Step 1: 添加中文翻译**

在 `lib/locales/zh.ts` 中添加（在适当位置）：

```typescript
// Tags
'tags.title': '标签管理',
'tags.conversationTags': '对话标签',
'tags.configTags': '配置标签',
'tags.create': '新建标签',
'tags.edit': '编辑标签',
'tags.delete': '删除标签',
'tags.name': '标签名称',
'tags.namePlaceholder': '输入标签名称...',
'tags.color': '标签颜色',
'tags.selectTags': '选择标签',
'tags.filterByTag': '按标签筛选',
'tags.all': '全部',
'tags.noTags': '暂无标签',
'tags.confirmDelete': '确认删除',
'tags.confirmDeleteMsg': '删除标签后，所有使用该标签的项目将失去此标签。确定要删除吗？',
'tags.createSuccess': '标签创建成功',
'tags.updateSuccess': '标签更新成功',
'tags.deleteSuccess': '标签删除成功',
'tags.nameRequired': '标签名称不能为空',
'tags.nameTooLong': '标签名称不能超过 20 个字符',
'tags.maxTagsReached': '最多只能选择 10 个标签',
```

- [ ] **Step 2: 添加英文翻译**

在 `lib/locales/en.ts` 中添加：

```typescript
// Tags
'tags.title': 'Tag Management',
'tags.conversationTags': 'Conversation Tags',
'tags.configTags': 'Config Tags',
'tags.create': 'Create Tag',
'tags.edit': 'Edit Tag',
'tags.delete': 'Delete Tag',
'tags.name': 'Tag Name',
'tags.namePlaceholder': 'Enter tag name...',
'tags.color': 'Tag Color',
'tags.selectTags': 'Select Tags',
'tags.filterByTag': 'Filter by Tag',
'tags.all': 'All',
'tags.noTags': 'No tags yet',
'tags.confirmDelete': 'Confirm Delete',
'tags.confirmDeleteMsg': 'Deleting this tag will remove it from all associated items. Are you sure?',
'tags.createSuccess': 'Tag created successfully',
'tags.updateSuccess': 'Tag updated successfully',
'tags.deleteSuccess': 'Tag deleted successfully',
'tags.nameRequired': 'Tag name is required',
'tags.nameTooLong': 'Tag name cannot exceed 20 characters',
'tags.maxTagsReached': 'Maximum 10 tags allowed',
```

- [ ] **Step 3: 验证翻译键**

运行 TypeScript 检查确保翻译键类型正确：

```bash
pnpm lint
```

- [ ] **Step 4: 提交**

```bash
git add lib/locales/zh.ts lib/locales/en.ts
git commit -m "feat(i18n): 添加标签系统国际化翻译"
```

---

## Task 8: UI 组件 — TagBadge 标签胶囊

**Files:**
- Create: `components/ui/TagBadge.tsx`

- [ ] **Step 1: 创建 TagBadge 组件**

创建 `components/ui/TagBadge.tsx`：

```typescript
'use client';

import { X } from 'lucide-react';

interface TagBadgeProps {
  name: string;
  color: string;
  size?: 'sm' | 'md';
  onRemove?: () => void;
  onClick?: () => void;
  selected?: boolean;
  className?: string;
}

/** 标签胶囊组件 */
export default function TagBadge({
  name,
  color,
  size = 'sm',
  onRemove,
  onClick,
  selected = false,
  className = '',
}: TagBadgeProps) {
  const sizeClasses = size === 'sm'
    ? 'px-1.5 py-0.5 text-[10px]'
    : 'px-2 py-1 text-xs';

  const baseClasses = `
    inline-flex items-center gap-1 rounded-full font-medium transition-all duration-200
    ${sizeClasses}
    ${onClick ? 'cursor-pointer' : ''}
    ${selected
      ? 'ring-2 ring-offset-1'
      : 'opacity-90 hover:opacity-100'
    }
    ${className}
  `;

  const style = {
    backgroundColor: `${color}20`,
    color: color,
    borderColor: `${color}40`,
    ...(selected ? { ringColor: color } : {}),
  };

  return (
    <span
      className={baseClasses}
      style={style}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
    >
      <span className="truncate max-w-[100px]">{name}</span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 hover:opacity-70 transition-opacity"
        >
          <X size={size === 'sm' ? 10 : 12} />
        </button>
      )}
    </span>
  );
}
```

- [ ] **Step 2: 验证组件**

运行 TypeScript 检查：

```bash
pnpm lint
```

- [ ] **Step 3: 提交**

```bash
git add components/ui/TagBadge.tsx
git commit -m "feat(ui): 实现 TagBadge 标签胶囊组件"
```

---

## Task 9: UI 组件 — TagCloudSelector 标签云选择器

**Files:**
- Create: `components/ui/TagCloudSelector.tsx`

- [ ] **Step 1: 创建 TagCloudSelector 组件**

创建 `components/ui/TagCloudSelector.tsx`：

```typescript
'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import TagBadge from './TagBadge';
import { useLocale } from '@/lib/locales';
import type { ConversationTag, ConfigTag } from '@/lib/types';

interface TagCloudSelectorProps {
  tags: ConversationTag[] | ConfigTag[];
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
  onClose: () => void;
  maxTags?: number;
}

/** 标签云选择器组件 */
export default function TagCloudSelector({
  tags,
  selectedTagIds,
  onChange,
  onClose,
  maxTags = 10,
}: TagCloudSelectorProps) {
  const { t } = useLocale();
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 自动聚焦搜索框
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // 过滤标签
  const filteredTags = searchQuery
    ? tags.filter(tag => tag.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : tags;

  // 切换标签选择
  const toggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter(id => id !== tagId));
    } else if (selectedTagIds.length < maxTags) {
      onChange([...selectedTagIds, tagId]);
    }
  };

  return (
    <div
      ref={containerRef}
      className="absolute top-full left-0 mt-1 z-50 w-64 bg-[var(--surface-warm)] backdrop-blur-xl rounded-2xl border border-[var(--border)] shadow-[0_10px_40px_rgba(28,25,23,0.10)] overflow-hidden animate-slide-up"
    >
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-black/5">
        <span className="text-sm font-medium text-[var(--fg)]">{t('tags.selectTags')}</span>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200"
        >
          <X size={14} />
        </button>
      </div>

      {/* 搜索框 */}
      <div className="px-3 py-2 border-b border-black/5">
        <div className="relative flex items-center">
          <Search size={14} className="absolute left-2.5 text-[var(--muted)]/50" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder={t('tags.name') + '...'}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-[var(--surface-warm-hover)] rounded-lg text-[var(--fg)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--accent-indigo)]/20"
          />
        </div>
      </div>

      {/* 标签云 */}
      <div className="p-3 max-h-48 overflow-y-auto scrollbar-thin">
        {filteredTags.length === 0 ? (
          <div className="text-center py-4 text-sm text-[var(--muted)]">
            {searchQuery ? t('conversation.noResults') : t('tags.noTags')}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {filteredTags.map(tag => (
              <TagBadge
                key={tag.id}
                name={tag.name}
                color={tag.color}
                size="md"
                selected={selectedTagIds.includes(tag.id)}
                onClick={() => toggleTag(tag.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 底部提示 */}
      {selectedTagIds.length > 0 && (
        <div className="px-4 py-2 border-t border-black/5 text-[11px] text-[var(--muted)]">
          {selectedTagIds.length}/{maxTags} {t('tags.selectTags')}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 验证组件**

运行 TypeScript 检查：

```bash
pnpm lint
```

- [ ] **Step 3: 提交**

```bash
git add components/ui/TagCloudSelector.tsx
git commit -m "feat(ui): 实现 TagCloudSelector 标签云选择器"
```

---

## Task 10: UI 组件 — TagFilter 标签筛选器

**Files:**
- Create: `components/ui/TagFilter.tsx`

- [ ] **Step 1: 创建 TagFilter 组件**

创建 `components/ui/TagFilter.tsx`：

```typescript
'use client';

import TagBadge from './TagBadge';
import { useLocale } from '@/lib/locales';
import type { ConversationTag, ConfigTag } from '@/lib/types';

interface TagFilterProps {
  tags: ConversationTag[] | ConfigTag[];
  selectedTagId: string | null;
  onChange: (tagId: string | null) => void;
}

/** 标签筛选器组件 */
export default function TagFilter({
  tags,
  selectedTagId,
  onChange,
}: TagFilterProps) {
  const { t } = useLocale();

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin py-1">
      <TagBadge
        name={t('tags.all')}
        color={selectedTagId === null ? '#6366f1' : '#94a3b8'}
        size="md"
        selected={selectedTagId === null}
        onClick={() => onChange(null)}
      />
      {tags.map(tag => (
        <TagBadge
          key={tag.id}
          name={tag.name}
          color={tag.color}
          size="md"
          selected={selectedTagId === tag.id}
          onClick={() => onChange(selectedTagId === tag.id ? null : tag.id)}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 验证组件**

运行 TypeScript 检查：

```bash
pnpm lint
```

- [ ] **Step 3: 提交**

```bash
git add components/ui/TagFilter.tsx
git commit -m "feat(ui): 实现 TagFilter 标签筛选器"
```

---

## Task 11: 设置页 — TagSettings 标签管理

**Files:**
- Create: `components/settings/TagSettings.tsx`

- [ ] **Step 1: 创建 TagSettings 组件**

创建 `components/settings/TagSettings.tsx`：

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, X, Check } from 'lucide-react';
import * as api from '@/lib/api/client';
import { useNotification } from '@/lib/contexts/NotificationContext';
import ConfirmDialog from '@/components/dialogs/ConfirmDialog';
import ScrollToTop from '@/components/ui/ScrollToTop';
import { useLocale } from '@/lib/locales';
import type { ConversationTag, ConfigTag, ConfirmDialogState } from '@/lib/types';

/** 预设颜色 */
const PRESET_COLORS = [
  { value: '#6366f1', name: '靛蓝' },
  { value: '#8b5cf6', name: '紫色' },
  { value: '#ec4899', name: '粉色' },
  { value: '#f43f5e', name: '红色' },
  { value: '#f97316', name: '橙色' },
  { value: '#eab308', name: '黄色' },
  { value: '#22c55e', name: '绿色' },
  { value: '#06b6d4', name: '青色' },
];

/** 标签管理组件 */
export function TagSettings() {
  const { t } = useLocale();
  const { showNotification } = useNotification();

  // 对话标签状态
  const [conversationTags, setConversationTags] = useState<ConversationTag[]>([]);
  const [editingConvTag, setEditingConvTag] = useState<Partial<ConversationTag> | null>(null);
  const [isCreatingConvTag, setIsCreatingConvTag] = useState(false);

  // 配置标签状态
  const [configTags, setConfigTags] = useState<ConfigTag[]>([]);
  const [editingConfigTag, setEditingConfigTag] = useState<Partial<ConfigTag> | null>(null);
  const [isCreatingConfigTag, setIsCreatingConfigTag] = useState(false);

  // 确认对话框
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
  });

  // 加载标签
  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    try {
      const [convTags, cfgTags] = await Promise.all([
        api.fetchConversationTags(),
        api.fetchConfigTags(),
      ]);
      setConversationTags(convTags);
      setConfigTags(cfgTags);
    } catch (err) {
      console.error('Failed to load tags:', err);
    }
  };

  // ==================== 对话标签操作 ====================

  const handleCreateConvTag = () => {
    setIsCreatingConvTag(true);
    setEditingConvTag({ name: '', color: PRESET_COLORS[0].value });
  };

  const handleSaveConvTag = async () => {
    if (!editingConvTag?.name?.trim()) {
      showNotification(t('tags.createSuccess'), t('tags.nameRequired'), 'error');
      return;
    }

    if (editingConvTag.name.length > 20) {
      showNotification(t('tags.createSuccess'), t('tags.nameTooLong'), 'error');
      return;
    }

    try {
      if (isCreatingConvTag) {
        await api.createConversationTag({
          name: editingConvTag.name,
          color: editingConvTag.color || PRESET_COLORS[0].value,
        });
        showNotification(t('tags.createSuccess'), '', 'success');
      } else {
        await api.updateConversationTag(editingConvTag.id!, {
          name: editingConvTag.name,
          color: editingConvTag.color,
        });
        showNotification(t('tags.updateSuccess'), '', 'success');
      }
      setEditingConvTag(null);
      setIsCreatingConvTag(false);
      await loadTags();
    } catch (err) {
      showNotification(t('tags.createSuccess'), (err as Error).message, 'error');
    }
  };

  const handleDeleteConvTag = (tag: ConversationTag) => {
    setConfirmDialog({
      isOpen: true,
      title: t('tags.confirmDelete'),
      message: t('tags.confirmDeleteMsg'),
      onConfirm: async () => {
        try {
          await api.deleteConversationTag(tag.id);
          showNotification(t('tags.deleteSuccess'), '', 'success');
          await loadTags();
        } catch (err) {
          showNotification(t('tags.deleteSuccess'), (err as Error).message, 'error');
        }
      },
    });
  };

  // ==================== 配置标签操作 ====================

  const handleCreateConfigTag = () => {
    setIsCreatingConfigTag(true);
    setEditingConfigTag({ name: '', color: PRESET_COLORS[0].value });
  };

  const handleSaveConfigTag = async () => {
    if (!editingConfigTag?.name?.trim()) {
      showNotification(t('tags.createSuccess'), t('tags.nameRequired'), 'error');
      return;
    }

    if (editingConfigTag.name.length > 20) {
      showNotification(t('tags.createSuccess'), t('tags.nameTooLong'), 'error');
      return;
    }

    try {
      if (isCreatingConfigTag) {
        await api.createConfigTag({
          name: editingConfigTag.name,
          color: editingConfigTag.color || PRESET_COLORS[0].value,
        });
        showNotification(t('tags.createSuccess'), '', 'success');
      } else {
        await api.updateConfigTag(editingConfigTag.id!, {
          name: editingConfigTag.name,
          color: editingConfigTag.color,
        });
        showNotification(t('tags.updateSuccess'), '', 'success');
      }
      setEditingConfigTag(null);
      setIsCreatingConfigTag(false);
      await loadTags();
    } catch (err) {
      showNotification(t('tags.createSuccess'), (err as Error).message, 'error');
    }
  };

  const handleDeleteConfigTag = (tag: ConfigTag) => {
    setConfirmDialog({
      isOpen: true,
      title: t('tags.confirmDelete'),
      message: t('tags.confirmDeleteMsg'),
      onConfirm: async () => {
        try {
          await api.deleteConfigTag(tag.id);
          showNotification(t('tags.deleteSuccess'), '', 'success');
          await loadTags();
        } catch (err) {
          showNotification(t('tags.deleteSuccess'), (err as Error).message, 'error');
        }
      },
    });
  };

  // 渲染标签列表
  const renderTagList = (
    tags: ConversationTag[] | ConfigTag[],
    type: 'conversation' | 'config',
  ) => {
    const editingTag = type === 'conversation' ? editingConvTag : editingConfigTag;
    const isCreating = type === 'conversation' ? isCreatingConvTag : isCreatingConfigTag;
    const setEditingTag = type === 'conversation' ? setEditingConvTag : setEditingConfigTag;
    const handleSave = type === 'conversation' ? handleSaveConvTag : handleSaveConfigTag;
    const handleDelete = type === 'conversation' ? handleDeleteConvTag : handleDeleteConfigTag;
    const handleCreate = type === 'conversation' ? handleCreateConvTag : handleCreateConfigTag;
    const setIsCreating = type === 'conversation' ? setIsCreatingConvTag : setIsCreatingConfigTag;

    return (
      <div className="space-y-3">
        {/* 标签列表 */}
        <ScrollToTop className="max-h-64 overflow-y-auto scrollbar-thin">
          <div className="space-y-2">
            {tags.length === 0 ? (
              <div className="text-center py-8 text-sm text-[var(--muted)]">
                {t('tags.noTags')}
              </div>
            ) : (
              tags.map(tag => (
                <div
                  key={tag.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-warm-hover)] hover:bg-[var(--border)] transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="text-sm text-[var(--fg)]">{tag.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingTag({ ...tag });
                        setIsCreating(false);
                      }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(tag)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-500/10 transition-all duration-200"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollToTop>

        {/* 新建按钮 */}
        <button
          onClick={handleCreate}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-[var(--accent-indigo)] bg-[var(--accent-indigo)]/10 hover:bg-[var(--accent-indigo)]/20 rounded-xl transition-all duration-200 font-medium"
        >
          <Plus size={14} />
          {t('tags.create')}
        </button>

        {/* 编辑/创建表单 */}
        {editingTag && (
          <div className="p-4 rounded-xl bg-[var(--surface-warm-hover)] border border-[var(--border)] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[var(--fg)]">
                {isCreating ? t('tags.create') : t('tags.edit')}
              </span>
              <button
                onClick={() => {
                  setEditingTag(null);
                  setIsCreating(false);
                }}
                className="w-6 h-6 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200"
              >
                <X size={14} />
              </button>
            </div>

            <input
              type="text"
              value={editingTag.name || ''}
              onChange={(e) => setEditingTag({ ...editingTag, name: e.target.value })}
              placeholder={t('tags.namePlaceholder')}
              maxLength={20}
              className="w-full px-3 py-2 text-sm bg-[var(--surface-warm)] border border-[var(--border)] rounded-lg text-[var(--fg)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent-indigo)]/30"
            />

            <div>
              <label className="block text-xs text-[var(--muted)] mb-2">{t('tags.color')}</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color.value}
                    onClick={() => setEditingTag({ ...editingTag, color: color.value })}
                    className={`w-7 h-7 rounded-full transition-all duration-200 ${
                      editingTag.color === color.value
                        ? 'ring-2 ring-offset-2 ring-[var(--accent-indigo)]'
                        : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: color.value }}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={handleSave}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-[var(--btn-primary-text)] bg-[var(--btn-primary)] rounded-xl hover:bg-[var(--btn-primary-hover)] active:scale-[0.98] transition-all duration-200 font-medium"
            >
              <Check size={14} />
              {isCreating ? t('common.create') : t('common.save')}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 对话标签 */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--fg)] mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent-indigo)]" />
              {t('tags.conversationTags')}
              <span className="text-[var(--muted)] font-normal">({conversationTags.length})</span>
            </h3>
            {renderTagList(conversationTags, 'conversation')}
          </div>

          {/* 配置标签 */}
          <div>
            <h3 className="text-sm font-semibold text-[var(--fg)] mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent-cyan)]" />
              {t('tags.configTags')}
              <span className="text-[var(--muted)] font-normal">({configTags.length})</span>
            </h3>
            {renderTagList(configTags, 'config')}
          </div>
        </div>
      </div>

      {/* 删除确认对话框 */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm ?? (() => {})}
        title={confirmDialog.title}
        message={confirmDialog.message}
      />
    </div>
  );
}
```

- [ ] **Step 2: 验证组件**

运行 TypeScript 检查：

```bash
pnpm lint
```

- [ ] **Step 3: 提交**

```bash
git add components/settings/TagSettings.tsx
git commit -m "feat(settings): 实现 TagSettings 标签管理组件"
```

---

## Task 12: 设置页集成 — 添加标签管理标签页

**Files:**
- Modify: `components/settings/SettingsSidebar.tsx`
- Modify: `app/settings/page.tsx`

- [ ] **Step 1: 修改 SettingsSidebar**

在 `components/settings/SettingsSidebar.tsx` 中：

1. 导入 `Tags` 图标：
```typescript
import { Palette, Wand2, Globe, MessageSquare, Database, Keyboard, Info, Tags, LucideIcon } from 'lucide-react';
```

2. 添加 `tags` 到 SettingsTab 类型：
```typescript
export type SettingsTab = 'appearance' | 'llm' | 'tags' | 'network' | 'conversations' | 'data' | 'shortcuts' | 'about';
```

3. 在 tabs 数组中添加标签管理（在 `llm` 之后）：
```typescript
const tabs: { key: SettingsTab; icon: LucideIcon; labelKey: TranslationKey }[] = [
  { key: 'appearance', icon: Palette, labelKey: 'settings.appearance' },
  { key: 'llm', icon: Wand2, labelKey: 'settings.llm' },
  { key: 'tags', icon: Tags, labelKey: 'tags.title' },
  { key: 'conversations', icon: MessageSquare, labelKey: 'settings.conversations' },
  { key: 'data', icon: Database, labelKey: 'settings.data' },
  { key: 'shortcuts', icon: Keyboard, labelKey: 'settings.shortcuts' },
  { key: 'network', icon: Globe, labelKey: 'settings.network' },
  { key: 'about', icon: Info, labelKey: 'settings.about' },
];
```

- [ ] **Step 2: 修改设置页面**

在 `app/settings/page.tsx` 中：

1. 导入 TagSettings 组件：
```typescript
import { TagSettings } from '@/components/settings/TagSettings';
```

2. 在 switch 语句中添加 `tags` case：
```typescript
case 'tags':
  return <TagSettings />;
```

- [ ] **Step 3: 验证集成**

运行开发服务器，访问设置页，确认标签管理标签页正常显示：

```bash
pnpm dev
```

访问 `http://localhost:3000/settings?tab=tags`

- [ ] **Step 4: 提交**

```bash
git add components/settings/SettingsSidebar.tsx app/settings/page.tsx
git commit -m "feat(settings): 集成标签管理到设置页"
```

---

## Task 13: 对话列表集成 — 标签显示和筛选

**Files:**
- Modify: `components/ai/ConversationList.tsx`

- [ ] **Step 1: 添加标签状态和加载**

在 `ConversationList` 组件中添加：

```typescript
import TagBadge from '@/components/ui/TagBadge';
import TagFilter from '@/components/ui/TagFilter';
import type { ConversationTag } from '@/lib/types';

// 在组件内部添加状态
const [tags, setTags] = useState<ConversationTag[]>([]);
const [conversationTagsMap, setConversationTagsMap] = useState<Record<string, ConversationTag[]>>({});
const [selectedTagId, setSelectedTagId] = useState<string | null>(null);

// 加载标签
useEffect(() => {
  const loadTags = async () => {
    try {
      const convTags = await api.fetchConversationTags();
      setTags(convTags);
    } catch (err) {
      console.error('Failed to load tags:', err);
    }
  };
  loadTags();
}, []);

// 加载对话标签
useEffect(() => {
  if (!isOpen || conversations.length === 0) return;

  const loadConversationTags = async () => {
    const tagsMap: Record<string, ConversationTag[]> = {};
    await Promise.all(
      conversations.map(async (conv) => {
        try {
          const convTags = await api.fetchConversationTagsByIds(conv.id);
          tagsMap[conv.id] = convTags;
        } catch {
          // 静默忽略
        }
      }),
    );
    setConversationTagsMap(tagsMap);
  };

  loadConversationTags();
}, [isOpen, conversations]);
```

- [ ] **Step 2: 添加标签筛选逻辑**

修改 `loadConversations` 函数，支持按标签筛选：

```typescript
const loadConversations = useCallback(async (reset: boolean) => {
  if (isLoading) return;
  setIsLoading(true);
  try {
    const offset = reset ? 0 : offsetRef.current;
    const result = await api.fetchConversations({
      limit: PAGE_SIZE,
      offset,
      search: searchQuery || undefined,
      tagId: selectedTagId || undefined,  // 添加标签筛选
    });
    setConversations(prev => reset ? result.conversations : [...prev, ...result.conversations]);
    setHasMore(result.hasMore);
    offsetRef.current = offset + result.conversations.length;
  } catch (err) {
    console.error('Failed to load conversations:', err);
  } finally {
    setIsLoading(false);
  }
}, [isLoading, searchQuery, selectedTagId]);  // 添加 selectedTagId 依赖
```

- [ ] **Step 3: 添加标签筛选器 UI**

在搜索框之后添加标签筛选器：

```typescript
{/* Tag filter */}
{tags.length > 0 && (
  <div className="px-3 py-2 border-b border-black/5">
    <TagFilter
      tags={tags}
      selectedTagId={selectedTagId}
      onChange={setSelectedTagId}
    />
  </div>
)}
```

- [ ] **Step 4: 在列表项中显示标签**

修改列表项渲染，添加标签显示：

```typescript
{conversations.map((conv) => {
  const badge = FORMAT_BADGES[conv.format] || FORMAT_BADGES.excalidraw;
  const convTags = conversationTagsMap[conv.id] || [];
  return (
    <div
      key={conv.id}
      onClick={() => { onSelect(conv.id); setIsOpen(false); }}
      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
        conv.id === currentId ? 'bg-[var(--accent-indigo)]/5' : 'hover:bg-[var(--surface-warm-hover)]'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${badge.color}`}>
            {badge.label}
          </span>
          <span className="text-sm text-[var(--fg)] truncate">{conv.title}</span>
        </div>
        {/* 标签显示 */}
        {convTags.length > 0 && (
          <div className="flex items-center gap-1 mb-0.5 flex-wrap">
            {convTags.slice(0, 3).map(tag => (
              <TagBadge key={tag.id} name={tag.name} color={tag.color} size="sm" />
            ))}
            {convTags.length > 3 && (
              <span className="text-[10px] text-[var(--muted)]">+{convTags.length - 3}</span>
            )}
          </div>
        )}
        <div className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
          <span>{conv.messageCount} {t('conversation.messages')}</span>
          <span>{timeAgo(conv.updatedAt, t)}</span>
        </div>
      </div>
    </div>
  );
})}
```

- [ ] **Step 5: 验证集成**

运行开发服务器，测试对话列表的标签显示和筛选功能。

- [ ] **Step 6: 提交**

```bash
git add components/ai/ConversationList.tsx
git commit -m "feat(conversation): 集成标签显示和筛选到对话列表"
```

---

## Task 14: LLM 配置集成 — 标签显示和筛选

**Files:**
- Modify: `components/settings/LLMSettings.tsx`

- [ ] **Step 1: 添加标签状态和加载**

在 `LLMSettings` 组件中添加：

```typescript
import TagBadge from '@/components/ui/TagBadge';
import TagCloudSelector from '@/components/ui/TagCloudSelector';
import TagFilter from '@/components/ui/TagFilter';
import type { ConfigTag } from '@/lib/types';

// 在组件内部添加状态
const [tags, setTags] = useState<ConfigTag[]>([]);
const [configTagsMap, setConfigTagsMap] = useState<Record<string, ConfigTag[]>>({});
const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
const [showTagSelector, setShowTagSelector] = useState<string | null>(null); // configId

// 加载标签
useEffect(() => {
  const loadTags = async () => {
    try {
      const cfgTags = await api.fetchConfigTags();
      setTags(cfgTags);
    } catch (err) {
      console.error('Failed to load tags:', err);
    }
  };
  loadTags();
}, []);

// 加载配置标签
useEffect(() => {
  if (configs.length === 0) return;

  const loadConfigTags = async () => {
    const tagsMap: Record<string, ConfigTag[]> = {};
    await Promise.all(
      configs.map(async (config) => {
        try {
          const cfgTags = await api.fetchConfigTagsByIds(config.id!);
          tagsMap[config.id!] = cfgTags;
        } catch {
          // 静默忽略
        }
      }),
    );
    setConfigTagsMap(tagsMap);
  };

  loadConfigTags();
}, [configs]);
```

- [ ] **Step 2: 添加标签筛选逻辑**

修改 `filteredConfigs` 计算逻辑：

```typescript
const filteredConfigs = useMemo(() => {
  let result = searchQuery
    ? configs.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.type.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : configs;

  // 按标签筛选
  if (selectedTagId) {
    result = result.filter(c => {
      const cfgTags = configTagsMap[c.id!] || [];
      return cfgTags.some(tag => tag.id === selectedTagId);
    });
  }

  return result.sort((a, b) => (a.id === activeConfigId ? -1 : b.id === activeConfigId ? 1 : 0));
}, [configs, searchQuery, activeConfigId, selectedTagId, configTagsMap]);
```

- [ ] **Step 3: 添加标签筛选器 UI**

在搜索框之后添加标签筛选器：

```typescript
{/* Tag filter */}
{tags.length > 0 && (
  <div className="mb-4">
    <TagFilter
      tags={tags}
      selectedTagId={selectedTagId}
      onChange={setSelectedTagId}
    />
  </div>
)}
```

- [ ] **Step 4: 在配置列表项中显示标签**

修改配置列表项渲染，添加标签显示和选择器：

```typescript
{filteredConfigs.map((config) => {
  const cfgTags = configTagsMap[config.id!] || [];
  return (
    <div
      key={config.id}
      className={`group p-4 rounded-2xl border transition-all duration-200 ${
        config.id === activeConfigId
          ? 'border-[var(--accent-indigo)]/30 bg-[var(--accent-indigo)]/5'
          : 'border-transparent bg-[var(--surface-warm-hover)] hover:bg-[var(--border)]'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 min-w-0">
            <h3 className="text-sm font-semibold text-[var(--fg)] truncate">{config.name}</h3>
            {config.id === activeConfigId && (
              <span className="px-2 py-0.5 text-[11px] font-medium bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)] rounded-lg flex-shrink-0">
                {t('config.active')}
              </span>
            )}
            <span className="px-2 py-0.5 text-[11px] bg-[var(--surface-warm-hover)] text-[var(--muted)] rounded-lg flex-shrink-0">
              {config.type}
            </span>
          </div>
          {/* 标签显示 */}
          <div className="flex items-center gap-1 mb-1.5 flex-wrap relative">
            {cfgTags.slice(0, 3).map(tag => (
              <TagBadge key={tag.id} name={tag.name} color={tag.color} size="sm" />
            ))}
            {cfgTags.length > 3 && (
              <span className="text-[10px] text-[var(--muted)]">+{cfgTags.length - 3}</span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowTagSelector(showTagSelector === config.id ? null : config.id!);
              }}
              className="w-5 h-5 flex items-center justify-center rounded-full text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200"
            >
              <Plus size={12} />
            </button>
            {/* 标签选择器 */}
            {showTagSelector === config.id && (
              <TagCloudSelector
                tags={tags}
                selectedTagIds={cfgTags.map(t => t.id)}
                onChange={async (tagIds) => {
                  try {
                    await api.setConfigTags(config.id!, tagIds);
                    const updatedTags = await api.fetchConfigTagsByIds(config.id!);
                    setConfigTagsMap(prev => ({ ...prev, [config.id!]: updatedTags }));
                  } catch (err) {
                    console.error('Failed to update config tags:', err);
                  }
                }}
                onClose={() => setShowTagSelector(null)}
              />
            )}
          </div>
          {config.description && (
            <p className="text-xs text-[var(--muted)] mb-1.5 truncate">{config.description}</p>
          )}
          <div className="text-[11px] text-[var(--muted)]/70 space-y-0.5">
            <div className="truncate">URL: {config.baseUrl}</div>
            <div className="truncate">{t('config.modelPrefix')} {config.model}</div>
          </div>
        </div>
        {/* ... existing action buttons ... */}
      </div>
    </div>
  );
})}
```

- [ ] **Step 5: 验证集成**

运行开发服务器，测试配置列表的标签显示和筛选功能。

- [ ] **Step 6: 提交**

```bash
git add components/settings/LLMSettings.tsx
git commit -m "feat(config): 集成标签显示和筛选到 LLM 配置列表"
```

---

## Task 15: 扩展对话 API 支持标签筛选

**Files:**
- Modify: `app/api/conversations/route.ts`
- Modify: `lib/db/conversation-manager.ts`

- [ ] **Step 1: 修改 ConversationManager.search 方法**

在 `lib/db/conversation-manager.ts` 的 `search` 方法中添加标签筛选支持：

```typescript
async search(params: {
  query?: string;
  tagId?: string;  // 添加标签筛选参数
  sort?: string;
  order?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  conversations: Conversation[];
  total: number;
}> {
  const db = await getDb();
  const { query, tagId, sort = 'updated_at', order = 'desc', limit = 20, offset = 0 } = params;

  // 构建 WHERE 子句
  const whereClauses: string[] = [];
  const queryParams: unknown[] = [];

  if (query && query.trim()) {
    whereClauses.push('LOWER(title) LIKE ?');
    queryParams.push(`%${query.toLowerCase()}%`);
  }

  // 标签筛选
  let joinClause = '';
  if (tagId) {
    joinClause = 'INNER JOIN conversation_tag_relations r ON c.id = r.conversation_id';
    whereClauses.push('r.tag_id = ?');
    queryParams.push(tagId);
  }

  const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // 验证排序字段，防止 SQL 注入
  const validSortFields = ['updated_at', 'created_at'];
  const validOrders = ['asc', 'desc'];
  const sortField = validSortFields.includes(sort) ? sort : 'updated_at';
  const sortOrder = validOrders.includes(order) ? order : 'desc';

  // 获取总数
  const countSql = `SELECT COUNT(*) as total FROM conversations c ${joinClause} ${whereStr}`;
  const countResult = db.exec(countSql, queryParams);
  const total = countResult.length > 0 ? (countResult[0].values[0][0] as number) : 0;

  // 获取分页数据
  const dataSql = `SELECT c.* FROM conversations c ${joinClause} ${whereStr} ORDER BY c.${sortField} ${sortOrder} LIMIT ? OFFSET ?`;
  const dataParams = [...queryParams, limit, offset];
  const stmt = db.prepare(dataSql);
  const conversations: Conversation[] = [];
  try {
    stmt.bind(dataParams);
    while (stmt.step()) {
      conversations.push(parseConversationRow(stmt.getAsObject() as Record<string, unknown>));
    }
  } finally {
    stmt.free();
  }

  return { conversations, total };
}
```

- [ ] **Step 2: 修改对话 API 路由**

在 `app/api/conversations/route.ts` 中添加 `tagId` 参数：

```typescript
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const tagId = searchParams.get('tagId') || undefined;  // 添加标签筛选
    const sort = searchParams.get('sort') || 'updated_at';
    const order = searchParams.get('order') || 'desc';
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 20;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : 0;

    const result = await conversationManager.search({
      query: search,
      tagId,  // 传递标签筛选
      sort,
      order,
      limit,
      offset,
    });

    return NextResponse.json({
      conversations: result.conversations,
      total: result.total,
      hasMore: offset + result.conversations.length < result.total,
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
```

- [ ] **Step 3: 验证筛选功能**

运行开发服务器，测试按标签筛选对话：

```bash
curl "http://localhost:3000/api/conversations?tagId=标签ID"
```

- [ ] **Step 4: 提交**

```bash
git add lib/db/conversation-manager.ts app/api/conversations/route.ts
git commit -m "feat(api): 扩展对话 API 支持标签筛选"
```

---

## Task 16: 最终验证和清理

- [ ] **Step 1: 运行完整测试**

```bash
cd d:/python/PycharmProjects/ai-sketch-project/ai-sketch
pnpm lint
pnpm build
```

确保无错误。

- [ ] **Step 2: 功能测试清单**

手动测试以下功能：

1. **标签管理**
   - [ ] 创建对话标签
   - [ ] 编辑对话标签
   - [ ] 删除对话标签
   - [ ] 创建配置标签
   - [ ] 编辑配置标签
   - [ ] 删除配置标签

2. **标签关联**
   - [ ] 给对话添加标签
   - [ ] 给对话移除标签
   - [ ] 给配置添加标签
   - [ ] 给配置移除标签

3. **标签筛选**
   - [ ] 对话列表按标签筛选
   - [ ] 配置列表按标签筛选

4. **视觉标记**
   - [ ] 对话列表显示标签
   - [ ] 配置列表显示标签

5. **国际化**
   - [ ] 中文界面正常显示
   - [ ] 英文界面正常显示

- [ ] **Step 3: 最终提交**

```bash
git add -A
git commit -m "feat: 标签系统完整实现"
```

---

## 完成

实现计划已完成并保存到 `docs/superpowers/plans/2026-03-22-tag-system.md`。

**两种执行方式：**

**1. Subagent-Driven（推荐）** - 每个任务分发给独立子代理执行，任务间进行审查，快速迭代

**2. Inline Execution** - 在当前会话中执行任务，批量执行并设置检查点

选择哪种方式？

# 标签系统设计文档

## 概述

为 AI Sketch 项目添加标签系统，支持用户手动给对话和 LLM 配置打标签，实现分类管理、筛选过滤和批量操作。

## 需求总结

- **主要用途**：纯手动标签系统，用户手动给对话/配置打标签
- **作用域**：独立标签池 — 对话标签和配置标签是两个独立的集合
- **使用场景**：筛选过滤、批量操作、视觉标记
- **数据模型**：标签实体（ID、名称、颜色）
- **管理入口**：设置页集中管理（新增"标签管理"标签页）
- **交互方式**：标签云选择器

## 架构设计

### 1. 数据库层

#### 新增表

**conversation_tags** — 对话标签定义
```sql
CREATE TABLE conversation_tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at INTEGER NOT NULL
);
```

**config_tags** — 配置标签定义
```sql
CREATE TABLE config_tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at INTEGER NOT NULL
);
```

**conversation_tag_relations** — 对话-标签关联
```sql
CREATE TABLE conversation_tag_relations (
  conversation_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (conversation_id, tag_id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES conversation_tags(id) ON DELETE CASCADE
);
```

**config_tag_relations** — 配置-标签关联
```sql
CREATE TABLE config_tag_relations (
  config_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (config_id, tag_id),
  FOREIGN KEY (config_id) REFERENCES llm_configs(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES config_tags(id) ON DELETE CASCADE
);
```

#### 索引

```sql
CREATE INDEX idx_conversation_tag_relations_tag ON conversation_tag_relations(tag_id);
CREATE INDEX idx_config_tag_relations_tag ON config_tag_relations(tag_id);
```

### 2. 数据访问层

#### TagManager 类

位置：`lib/db/tag-manager.ts`

**对话标签方法：**
- `getConversationTags(): Promise<ConversationTag[]>`
- `createConversationTag(data: { name: string; color: string }): Promise<ConversationTag>`
- `updateConversationTag(id: string, data: { name?: string; color?: string }): Promise<ConversationTag>`
- `deleteConversationTag(id: string): Promise<void>`
- `setConversationTags(conversationId: string, tagIds: string[]): Promise<void>`
- `getConversationTagsByIds(conversationId: string): Promise<ConversationTag[]>`

**配置标签方法：**
- `getConfigTags(): Promise<ConfigTag[]>`
- `createConfigTag(data: { name: string; color: string }): Promise<ConfigTag>`
- `updateConfigTag(id: string, data: { name?: string; color?: string }): Promise<ConfigTag>`
- `deleteConfigTag(id: string): Promise<void>`
- `setConfigTags(configId: string, tagIds: string[]): Promise<void>`
- `getConfigTagsByIds(configId: string): Promise<ConfigTag[]>`

**查询方法：**
- `getConversationsByTag(tagId: string): Promise<Conversation[]>`
- `getConfigsByTag(tagId: string): Promise<LLMConfig[]>`

#### 数据类型

```typescript
interface ConversationTag {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

interface ConfigTag {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}
```

### 3. API 层

#### 标签管理 API

**对话标签：**
- `GET /api/conversation-tags` — 获取所有对话标签
- `POST /api/conversation-tags` — 创建对话标签
  - Body: `{ name: string; color: string }`
- `PUT /api/conversation-tags/:id` — 更新对话标签
  - Body: `{ name?: string; color?: string }`
- `DELETE /api/conversation-tags/:id` — 删除对话标签

**配置标签：**
- `GET /api/config-tags` — 获取所有配置标签
- `POST /api/config-tags` — 创建配置标签
  - Body: `{ name: string; color: string }`
- `PUT /api/config-tags/:id` — 更新配置标签
  - Body: `{ name?: string; color?: string }`
- `DELETE /api/config-tags/:id` — 删除配置标签

#### 关联操作 API

- `PUT /api/conversations/:id/tags` — 设置对话标签（替换）
  - Body: `{ tagIds: string[] }`
- `PUT /api/configs/:id/tags` — 设置配置标签（替换）
  - Body: `{ tagIds: string[] }`

#### 筛选查询 API

扩展现有 API，添加 `tagId` 查询参数：
- `GET /api/conversations?tagId=xxx` — 按标签筛选对话
- `GET /api/configs?tagId=xxx` — 按标签筛选配置

### 4. UI 组件层

#### 设置页 - 标签管理标签页

位置：`components/settings/TagSettings.tsx`

**布局：**
- 左侧面板：对话标签管理
  - 标签列表（颜色圆点 + 名称 + 编辑/删除按钮）
  - 新建标签表单（名称输入 + 颜色选择）
- 右侧面板：配置标签管理
  - 同上

**颜色选择：**
提供 8 种预设颜色供选择：
- `#6366f1` (靛蓝)
- `#8b5cf6` (紫色)
- `#ec4899` (粉色)
- `#f43f5e` (红色)
- `#f97316` (橙色)
- `#eab308` (黄色)
- `#22c55e` (绿色)
- `#06b6d4` (青色)

#### 标签云选择器组件

位置：`components/ui/TagCloudSelector.tsx`

**Props：**
```typescript
interface TagCloudSelectorProps {
  tags: ConversationTag[] | ConfigTag[];
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
  onClose: () => void;
}
```

**功能：**
- 弹出面板，显示所有可用标签
- 标签以彩色胶囊形式展示
- 点击选择/取消（支持多选）
- 已选标签高亮显示
- 支持搜索过滤

#### 标签胶囊组件

位置：`components/ui/TagBadge.tsx`

**Props：**
```typescript
interface TagBadgeProps {
  name: string;
  color: string;
  size?: 'sm' | 'md';
  onRemove?: () => void;
}
```

**功能：**
- 显示标签名称，背景使用标签颜色
- 支持小尺寸（列表项中）和中等尺寸（详情页）
- 可选的移除按钮

#### 列表筛选组件

位置：`components/ui/TagFilter.tsx`

**Props：**
```typescript
interface TagFilterProps {
  tags: ConversationTag[] | ConfigTag[];
  selectedTagId: string | null;
  onChange: (tagId: string | null) => void;
}
```

**功能：**
- 水平标签栏，显示所有可用标签
- 点击选中/取消筛选
- "全部"选项重置筛选

### 5. 集成点

#### ConversationList 组件修改

- 列表项显示标签胶囊（小尺寸）
- 顶部添加标签筛选器
- 支持按标签全选和批量操作
  - 筛选后显示"全选"复选框
  - 选中后显示批量操作栏（删除、导出）
  - 批量删除需确认对话框

#### LLMSettings 组件修改

- 配置列表项显示标签胶囊（小尺寸）
- 顶部添加标签筛选器
- 配置编辑器中添加标签选择器
- 支持按标签全选和批量操作
  - 筛选后显示"全选"复选框
  - 选中后显示批量操作栏（删除、导出）
  - 批量删除需确认对话框

#### SettingsSidebar 修改

- 添加"标签管理"标签页入口

#### 国际化

在 `lib/locales/zh.ts` 和 `lib/locales/en.ts` 中添加：
- `tags.title` — "标签管理" / "Tag Management"
- `tags.conversationTags` — "对话标签" / "Conversation Tags"
- `tags.configTags` — "配置标签" / "Config Tags"
- `tags.create` — "新建标签" / "Create Tag"
- `tags.edit` — "编辑标签" / "Edit Tag"
- `tags.delete` — "删除标签" / "Delete Tag"
- `tags.name` — "标签名称" / "Tag Name"
- `tags.color` — "标签颜色" / "Tag Color"
- `tags.selectTags` — "选择标签" / "Select Tags"
- `tags.filterByTag` — "按标签筛选" / "Filter by Tag"
- `tags.all` — "全部" / "All"

## 实现顺序

1. **数据库层** — 创建表和索引，实现 TagManager
2. **API 层** — 实现标签管理 API 和关联操作 API
3. **UI 组件** — 实现标签云选择器、标签胶囊、标签筛选器
4. **设置页集成** — 实现标签管理标签页
5. **列表集成** — 修改 ConversationList 和 LLMSettings，添加标签显示和筛选
6. **国际化** — 添加所有相关翻译

## 技术约束

- 遵循现有项目模式（路径别名、组件结构、API 风格）
- 使用现有数据库层（sql.js WASM、requestSave、withTransaction）
- 使用现有 UI 组件库（Button、Modal、Dropdown 等）
- 支持国际化（useLocale、t 函数）
- 标签名称长度限制：20 字符
- 每个对话/配置最多 10 个标签

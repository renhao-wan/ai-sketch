# API 接口文档

本文档介绍 AI Sketch 后端 API 接口的详细说明。

## 基础信息

- **Base URL**: `/api`
- **Content-Type**: `application/json`
- **认证**: 无（API Key 存储在服务端 SQLite）

## 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/generate` | 流式生成图表代码 |
| POST | `/api/ai-action` | AI 操作（美化、布局、简化、解释） |
| GET | `/api/conversations` | 获取对话列表 |
| DELETE | `/api/conversations` | 删除对话 |
| GET | `/api/conversations/[id]` | 获取单个对话详情 |
| DELETE | `/api/conversations/[id]` | 删除单个对话 |
| GET | `/api/conversations/count` | 获取对话数量 |
| GET | `/api/configs` | 获取 LLM 配置列表 |
| POST | `/api/configs` | 创建配置或测试连接 |
| PUT | `/api/configs/[id]` | 更新配置 |
| DELETE | `/api/configs/[id]` | 删除配置 |
| POST | `/api/configs/actions` | 配置操作（设置活跃配置） |
| GET | `/api/models` | 获取可用模型列表 |

---

## 核心接口

### POST /api/generate

流式生成图表代码，返回 SSE（Server-Sent Events）流。

**请求体**:

```typescript
{
  configId?: string;           // LLM 配置 ID（与 config 二选一）
  config?: LLMConfig;          // 直接传入配置（与 configId 二选一）
  userInput: string | {        // 用户输入
    text?: string;             // 文本内容
    image?: ImageData;         // 单张图片
    images?: ImageData[];      // 多张图片
  };
  chartType: string;           // 图表类型（flowchart、sequence、class 等）
  format?: DiagramFormat;      // 输出格式（excalidraw、mermaid、drawio），默认 excalidraw
  conversationId?: string;     // 对话 ID（续接对话时传入）
  sourceType?: string;         // 来源类型（text、file、image）
  regenerate?: boolean;        // 是否重新生成
}

interface ImageData {
  data: string;       // base64 编码的图片数据
  mimeType: string;   // MIME 类型（如 image/png）
}
```

**SSE 事件流**:

```
data: {"type":"meta","conversationId":"conv_xxx"}

data: {"type":"content","content":"[{"}
data: {"type":"content","content":"  \"type\": \"rectangle\","}
data: {"type":"content","content":"  \"x\": 100,"}
...

data: [DONE]
```

**事件类型**:

| type | 说明 |
|------|------|
| `meta` | 元数据，包含 conversationId |
| `content` | 流式内容片段 |
| `error` | 错误信息 |
| `[DONE]` | 流结束标记 |

**错误响应**:

```json
{
  "error": "配置不存在: xxx"
}
```

**示例**:

```typescript
const response = await fetch('/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    configId: 'config_123',
    userInput: '画一个用户登录的流程图',
    chartType: 'flowchart',
    format: 'excalidraw',
  }),
});

const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader!.read();
  if (done) break;

  const text = decoder.decode(value);
  const lines = text.split('\n');

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') break;

      const event = JSON.parse(data);
      if (event.type === 'content') {
        // 处理内容片段
        accumulatedCode += event.content;
      }
    }
  }
}
```

---

### POST /api/ai-action

执行 AI 操作（美化、布局、简化、解释），返回 SSE 流。

**请求体**:

```typescript
{
  code: string;           // 当前图表代码
  format: DiagramFormat;  // 图表格式
  action: AIActionType;   // 操作类型
  configId?: string;      // LLM 配置 ID
}

type AIActionType = 'beautify' | 'layout' | 'simplify' | 'explain';
```

**操作类型说明**:

| action | 说明 |
|--------|------|
| `beautify` | 美化图表（优化颜色、样式） |
| `layout` | 重新布局（优化元素位置） |
| `simplify` | 简化图表（减少元素数量） |
| `explain` | 解释图表（生成文字说明） |

**SSE 事件流**:

```
data: {"type":"content","content":"..."}
...
data: {"type":"result","content":"..."}  // 非 explain 操作
data: [DONE]
```

---

## 对话管理接口

### GET /api/conversations

获取对话列表，支持搜索、分页和排序。

**查询参数**:

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `search` | string | - | 搜索关键词 |
| `sort` | string | `updated_at` | 排序字段 |
| `order` | string | `desc` | 排序方向（asc/desc） |
| `limit` | number | `20` | 每页数量 |
| `offset` | number | `0` | 偏移量 |

**响应**:

```json
{
  "conversations": [
    {
      "id": "conv_xxx",
      "title": "用户登录流程图",
      "chart_type": "flowchart",
      "format": "excalidraw",
      "config_name": "DeepSeek",
      "config_model": "deepseek-chat",
      "current_code": "[...]",
      "message_count": 5,
      "created_at": 1717000000000,
      "updated_at": 1717000000000
    }
  ],
  "total": 100,
  "hasMore": true
}
```

---

### DELETE /api/conversations

批量删除对话或清空所有对话。

**请求体**:

```json
{
  "ids": ["conv_1", "conv_2"]  // 可选，不传则清空所有
}
```

**响应**:

```json
{
  "success": true
}
```

---

### GET /api/conversations/[id]

获取单个对话详情，包含消息历史。

**响应**:

```json
{
  "id": "conv_xxx",
  "title": "用户登录流程图",
  "chart_type": "flowchart",
  "format": "excalidraw",
  "messages": [
    {
      "id": "msg_xxx",
      "role": "user",
      "content": "画一个用户登录的流程图",
      "source_type": "text",
      "created_at": 1717000000000
    },
    {
      "id": "msg_yyy",
      "role": "assistant",
      "content": "[...]",
      "source_type": "text",
      "created_at": 1717000001000
    }
  ]
}
```

---

### DELETE /api/conversations/[id]

删除单个对话。

**响应**:

```json
{
  "success": true
}
```

---

### GET /api/conversations/count

获取对话总数。

**响应**:

```json
{
  "count": 42
}
```

---

## LLM 配置接口

### GET /api/configs

获取所有 LLM 配置和当前活跃配置 ID。

**响应**:

```json
{
  "configs": [
    {
      "id": "config_xxx",
      "name": "DeepSeek",
      "type": "openai",
      "base_url": "https://api.deepseek.com/v1",
      "api_key": "sk-...",
      "model": "deepseek-chat",
      "description": "DeepSeek V3",
      "is_active": 1,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "activeConfigId": "config_xxx"
}
```

---

### POST /api/configs

创建新配置或测试连接。

**请求体**:

```json
{
  "action": "create",  // "create" 或 "test"
  "config": {
    "name": "DeepSeek",
    "type": "openai",
    "base_url": "https://api.deepseek.com/v1",
    "api_key": "sk-...",
    "model": "deepseek-chat"
  }
}
```

**响应（创建）**:

```json
{
  "id": "config_xxx",
  "name": "DeepSeek",
  ...
}
```

**响应（测试）**:

```json
{
  "success": true,
  "message": "连接成功",
  "models": ["deepseek-chat", "deepseek-coder"]
}
```

---

### PUT /api/configs/[id]

更新 LLM 配置。

**请求体**:

```json
{
  "name": "DeepSeek V3",
  "model": "deepseek-chat"
}
```

**响应**:

```json
{
  "id": "config_xxx",
  "name": "DeepSeek V3",
  ...
}
```

---

### DELETE /api/configs/[id]

删除 LLM 配置。

**响应**:

```json
{
  "success": true
}
```

---

### POST /api/configs/actions

配置操作（设置活跃配置）。

**请求体**:

```json
{
  "action": "set_active",
  "configId": "config_xxx"
}
```

**响应**:

```json
{
  "success": true
}
```

---

## 模型接口

### GET /api/models

获取可用模型列表。

**查询参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `configId` | string | 配置 ID（优先使用） |
| `type` | string | API 类型（openai/anthropic） |
| `baseUrl` | string | API Base URL |
| `apiKey` | string | API Key |

**响应**:

```json
{
  "models": [
    "deepseek-chat",
    "deepseek-coder",
    "gpt-4o",
    "gpt-4o-mini"
  ]
}
```

---

## 数据类型

### LLMConfig

```typescript
interface LLMConfig {
  id?: string;
  name: string;
  type: 'openai' | 'anthropic';
  base_url: string;
  api_key: string;
  model: string;
  description?: string;
  is_active?: number;
}
```

### DiagramFormat

```typescript
type DiagramFormat = 'excalidraw' | 'mermaid' | 'drawio';
```

### ImageData

```typescript
interface ImageData {
  data: string;       // base64 编码
  mimeType: string;   // 如 "image/png"
}
```

### Conversation

```typescript
interface Conversation {
  id: string;
  title: string;
  chart_type: string;
  format: DiagramFormat;
  config_name?: string;
  config_model?: string;
  current_code?: string;
  message_count: number;
  created_at: number;
  updated_at: number;
}
```

### Message

```typescript
interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  image_data?: string;
  image_mime_type?: string;
  source_type: string;
  created_at: number;
}
```

---

## 错误处理

所有接口在出错时返回统一格式：

```json
{
  "error": "错误信息"
}
```

**常见 HTTP 状态码**:

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

## 客户端封装

项目提供了统一的客户端封装 `lib/api/client.ts`：

```typescript
import { api } from '@/lib/api/client';

// 生成图表
const stream = await api.generate({
  configId: 'config_xxx',
  userInput: '画一个流程图',
  chartType: 'flowchart',
  format: 'excalidraw',
});

// 获取对话列表
const { conversations, total } = await api.getConversations({
  search: '流程图',
  limit: 20,
  offset: 0,
});

// 获取配置列表
const { configs, activeConfigId } = await api.getConfigs();
```

---

## 数据库表结构

### llm_configs

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| name | TEXT | 配置名称 |
| type | TEXT | API 类型（openai/anthropic） |
| base_url | TEXT | API Base URL |
| api_key | TEXT | API Key |
| model | TEXT | 模型名称 |
| description | TEXT | 描述 |
| is_active | INTEGER | 是否活跃 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

### conversations

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| title | TEXT | 标题 |
| chart_type | TEXT | 图表类型 |
| format | TEXT | 输出格式 |
| config_name | TEXT | 配置名称 |
| config_model | TEXT | 模型名称 |
| current_code | TEXT | 当前代码 |
| message_count | INTEGER | 消息数量 |
| created_at | INTEGER | 创建时间戳 |
| updated_at | INTEGER | 更新时间戳 |

### messages

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| conversation_id | TEXT | 对话 ID（外键） |
| role | TEXT | 角色（user/assistant） |
| content | TEXT | 内容 |
| image_data | TEXT | 图片数据（base64） |
| image_mime_type | TEXT | 图片 MIME 类型 |
| source_type | TEXT | 来源类型 |
| created_at | INTEGER | 创建时间戳 |

### meta

| 字段 | 类型 | 说明 |
|------|------|------|
| key | TEXT | 主键 |
| value | TEXT | 值 |

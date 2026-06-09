# 架构概览

本文档介绍 AI Sketch 项目的整体架构设计、核心模块和数据流。

## 系统架构

AI Sketch 采用 Next.js App Router 架构，前后端同构，支持 Web 端和 Electron 桌面端两种运行模式。

```
┌─────────────────────────────────────────────────────────────┐
│                        客户端（浏览器 / Electron）            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   首页       │  │   编辑器     │  │      设置页面        │ │
│  │  page.tsx    │  │ editor/     │  │    settings/        │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                      React 组件层                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ AI 面板   │ │ 图表画布  │ │ 代码编辑  │ │   通用 UI     │  │
│  │ components│ │ canvases │ │ editor   │ │     ui       │  │
│  │ /ai      │ │          │ │          │ │              │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                      核心库（lib/）                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ 策略模式  │ │ LLM 客户端│ │ 数据库    │ │ 响应缓存  │ │    工具函数    │  │
│  │strategies│ │   llm    │ │   db     │ │   cache   │ │    utils     │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                      API 路由层（app/api/）                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐   │
│  │ /api/generate │ │/api/conversations│ │ /api/configs   │   │
│  │  SSE 流式生成  │ │   对话 CRUD    │ │  LLM 配置管理   │   │
│  └──────────────┘ └──────────────┘ └──────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                      数据存储层                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              SQLite（sql.js WASM）                   │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐            │   │
│  │  │llm_configs│ │conversations│ │ messages │            │   │
│  │  └──────────┘ └──────────┘ └──────────┘            │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 核心设计模式

### 1. 图表格式策略模式（Diagram Strategy）

项目最核心的架构模式，用于隔离不同图表格式的处理逻辑。

```
DiagramStrategy（接口）
    ├── excalidrawStrategy（Excalidraw JSON）
    ├── mermaidStrategy（Mermaid 语法）
    └── drawioStrategy（Draw.io XML）
```

**职责**：
- 生成 LLM 系统提示词和用户提示词
- 后处理 LLM 输出（去除代码围栏、修复 JSON）
- 优化图表代码（如箭头对齐）
- 验证代码有效性
- 导出文件

**详细文档**：[图表格式策略模式](./diagram-strategy.md)

### 2. 输入类型策略模式（Input Strategy）

处理不同类型的用户输入（文本、文件、图片）。

```
InputStrategy（接口）
    ├── fileStrategy（文本文件）
    └── imageStrategy（图片文件）

InputOrchestrator（编排器）
    └── 协调多个策略的验证、处理、合并
```

**职责**：
- 验证输入文件类型和内容
- 处理文件（读取文本、转换图片为 base64）
- 合并多个输入为统一的消息格式

**详细文档**：[输入类型策略模式](./input-strategy.md)

## 数据流

### 图表生成流程

```
用户输入（文本/图片/文件）
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ 1. 输入处理（InputOrchestrator）                         │
│    - 验证输入                                            │
│    - 处理文件/图片                                        │
│    - 合并为 MessagePayload                               │
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ 2. API 请求（POST /api/generate）                        │
│    - 查询 LLM 配置                                       │
│    - 获取图表策略（getStrategy）                          │
│    - 构建 LLM 消息（系统提示 + 上下文 + 用户提示）          │
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ 3. LLM 调用（callLLM）                                   │
│    - SSE 流式返回                                        │
│    - 支持 OpenAI 兼容接口 / Anthropic API                 │
│    - 429 自动重试                                        │
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ 4. 客户端处理                                            │
│    - 实时累积 chunk                                      │
│    - 流结束后 postProcess + optimize                     │
│    - 渲染图表画布                                        │
│    - 保存对话消息                                        │
└─────────────────────────────────────────────────────────┘
```

### SSE 事件流

```
data: {"type":"meta","conversationId":"conv_xxx"}
data: {"type":"content","content":"[{"}
data: {"type":"content","content":"  type": "rectangle"}
data: {"type":"content","content":"  ..."}
...
data: [DONE]
```

## 模块依赖关系

```
app/page.tsx（首页）
    └── components/ai/AIPromptBox.tsx
        └── lib/api/client.ts（API 客户端）
            └── app/api/generate/route.ts（API 路由）
                ├── lib/db/config-manager.ts（配置管理）
                ├── lib/db/conversation-manager.ts（对话管理）
                ├── lib/strategies/registry.ts（策略注册表）
                │   ├── excalidraw-strategy.ts
                │   ├── mermaid-strategy.ts
                │   └── drawio-strategy.ts
                └── lib/llm/client.ts（LLM 客户端）

app/editor/page.tsx（编辑器）
    ├── components/ai/CopilotPanel.tsx（AI 面板）
    ├── components/canvases/DiagramCanvas.tsx（图表画布）
    │   ├── ExcalidrawCanvas.tsx
    │   ├── MermaidCanvas.tsx
    │   └── DrawioCanvas.tsx
    └── components/editor/CodeEditor.tsx（代码编辑器）
```

## 技术选型

### 为什么选择 SQLite（sql.js）？

- **零配置**：无需安装数据库服务器
- **WASM 运行**：sql.js 将 SQLite 编译为 WebAssembly，可在浏览器和 Node.js 中运行
- **单文件存储**：数据库就是一个文件，便于备份和迁移
- **Electron 兼容**：桌面端和 Web 端使用相同的数据库方案

### 为什么选择策略模式？

- **开闭原则**：新增图表格式无需修改现有代码
- **单一职责**：每个策略只处理一种格式
- **易于测试**：策略接口清晰，便于单元测试
- **可扩展性**：轻松支持新的图表格式

### 为什么选择 SSE 而不是 WebSocket？

- **HTTP 兼容**：SSE 基于标准 HTTP，无需升级协议
- **单向通信**：图表生成是单向流式输出，SSE 足够
- **自动重连**：浏览器原生支持 SSE 自动重连
- **简单实现**：Next.js API Routes 原生支持 SSE

## 错误处理

### 网络错误

- LLM 调用超时：5 分钟自动中断
- 429 速率限制：自动重试（指数退避）
- 网络断开：客户端显示错误提示

### 业务错误

- 配置不存在：返回 404
- 参数缺失：返回 400
- LLM 生成失败：保存失败标记，保持对话状态一致

### 前端错误

- JSON 解析失败：自动修复（去除代码围栏、修复闭合）
- 图表渲染失败：显示原始代码
- 全局 ErrorBoundary：捕获未处理的 React 错误

## 性能优化

- **流式生成**：边生成边渲染，无需等待完整响应
- **L1/L2 缓存**：内存热点缓存 + SQLite 持久缓存，重复请求秒级响应（详见[响应缓存](./response-cache.md)）
- **动态导入**：重型画布组件使用 `next/dynamic` + `ssr: false`
- **WASM 数据库**：sql.js 比纯 JS 实现更高效
- **懒加载**：Monaco Editor 按需加载

## 安全设计

- **contextIsolation**：Electron 启用上下文隔离
- **nodeIntegration**：禁用 Node.js 集成
- **API Key 保护**：密钥存储在 SQLite，不暴露给客户端
- **输入验证**：服务端验证所有用户输入

---

## 相关文档

- [设计模式](./design-patterns.md) — 项目中使用的所有设计模式详解
- [图表格式策略模式](./diagram-strategy.md) — DiagramStrategy 接口详解
- [输入类型策略模式](./input-strategy.md) — InputStrategy 接口详解
- [响应缓存](./response-cache.md) — L1/L2 分层缓存架构
- [数据管理](./data-management.md) — 数据文件和清理操作
- [API 接口文档](../api/endpoints.md) — 后端 API 接口说明
- [开发扩展指南](../guides/extend-diagram.md) — 如何添加新图表格式
- [部署指南](../guides/deployment.md) — Web 端和桌面端部署

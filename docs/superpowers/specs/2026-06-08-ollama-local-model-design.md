# Ollama 本地模型支持设计文档

## 概述

为 AI Sketch 添加 Ollama 本地模型运行时的原生支持，让用户可以完全离线使用 AI 图表生成功能。

## 范围

- 仅支持 Ollama（其他本地运行时可通过 OpenAI 兼容模式手动配置）
- 基础集成：Provider 类型、自动检测、模型列表、API Key 可选
- 不包含 prompt 适配和服务管理 UI

## 架构设计

### 1. 类型系统

**文件**: `lib/types/index.ts`

```typescript
export interface LLMConfig {
  type: 'openai' | 'anthropic' | 'ollama';  // 新增 'ollama'
  // 其他字段不变
}
```

API Key 对 Ollama 可选，存储时使用空字符串或占位符 `'ollama'`。

### 2. Ollama Provider

**文件**: `lib/llm/providers/ollama.ts`

实现 `LLMProvider` 接口，与 OpenAI Provider 的差异：

| 行为 | OpenAI | Ollama |
|------|--------|--------|
| API Key | 必需 | 可选 |
| 默认端口 | 443 | 11434 |
| 模型列表端点 | `/v1/models` | `/api/tags` |
| 模型列表格式 | `{data: [{id, name}]}` | `{models: [{name, ...}]}` |
| 流式响应 | SSE 格式 | SSE 格式（兼容） |

关键方法：
- `buildRequestHeaders(apiKey)`: API Key 为空时返回 `{'Content-Type': 'application/json'}`
- `getModelsEndpoint(baseUrl)`: 返回 `${baseUrl}/api/tags`
- `buildModelsRequestHeaders()`: 不需要 Authorization
- `getSSEExtractors()`: 复用 OpenAI 的 SSE 解析逻辑
- `processMessage()`: 复用 OpenAI 的消息处理逻辑

### 3. Provider 注册

**文件**: `lib/llm/providers/registry.ts`

```typescript
import { OllamaProvider } from './ollama';

const providers: Record<string, LLMProvider> = {
  openai: new OpenAIProvider(),
  anthropic: new AnthropicProvider(),
  ollama: new OllamaProvider(),  // 新增
};
```

### 4. 自动检测

**API 端点**: `POST /api/ollama/detect`

逻辑：
1. 尝试连接 `http://localhost:11434/api/tags`
2. 成功：返回 `{ detected: true, models: ModelInfo[] }`
3. 失败：返回 `{ detected: false, error: string }`

**UI 集成**: `components/settings/LLMSettings.tsx`

- 加载配置列表后，自动调用检测 API
- 检测到 Ollama 服务时，显示提示 Banner：
  - 标题："检测到 Ollama 服务"
  - 描述："发现 N 个可用模型，点击快速添加配置"
  - 操作按钮："添加 Ollama 配置"
- 点击按钮后，自动创建配置：
  - name: "Ollama (本地)"
  - type: "ollama"
  - baseUrl: "http://localhost:11434"
  - apiKey: "" (空)
  - model: 第一个可用模型

### 5. 配置编辑器调整

**文件**: `components/settings/LLMSettings.tsx` (ConfigEditor 组件)

Provider 类型下拉选项：
```typescript
options={[
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'ollama', label: 'Ollama' },
]}
```

选择 Ollama 时的 UI 变化：
- Base URL 默认填充 `http://localhost:11434`
- API Key 字段显示提示"Ollama 通常不需要 API Key"
- "获取模型"按钮使用 Ollama 的 `/api/tags` 端点

### 6. 验证逻辑调整

**文件**: `lib/db/config-manager.ts`

`validateConfig` 方法中，Ollama 跳过 API Key 验证：
```typescript
if (config.type !== 'ollama' && (!config.apiKey || config.apiKey.trim() === '')) {
  errors.push('API密钥不能为空');
}
```

### 7. 国际化

**文件**: `lib/locales/zh.ts`, `lib/locales/en.ts`

新增 key：
- `config.ollamaDetected`: "检测到 Ollama 服务" / "Ollama service detected"
- `config.ollamaDetectedDesc`: "发现 {count} 个可用模型" / "Found {count} available models"
- `config.addOllamaConfig`: "添加 Ollama 配置" / "Add Ollama config"
- `config.ollamaNoApiKey`: "Ollama 通常不需要 API Key" / "Ollama usually doesn't need an API key"
- `config.ollamaDefaultUrl`: "http://localhost:11434"

## 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `lib/types/index.ts` | 修改 | LLMConfig.type 新增 'ollama' |
| `lib/llm/providers/ollama.ts` | 新建 | Ollama Provider 实现 |
| `lib/llm/providers/registry.ts` | 修改 | 注册 OllamaProvider |
| `app/api/ollama/detect/route.ts` | 新建 | Ollama 检测 API |
| `components/settings/LLMSettings.tsx` | 修改 | 检测 Banner + 编辑器调整 |
| `lib/db/config-manager.ts` | 修改 | 验证逻辑调整 |
| `lib/locales/zh.ts` | 修改 | 新增 Ollama 相关翻译 |
| `lib/locales/en.ts` | 修改 | 新增 Ollama 相关翻译 |

## 不做的事

- 不做 prompt 适配（后续可选）
- 不做 Ollama 服务管理 UI（启动/停止/模型下载）
- 不支持其他本地运行时（LM Studio、vLLM 等）
- 不做自动启动 Ollama 服务

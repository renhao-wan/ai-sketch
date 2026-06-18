# 需求提取 LLM 两阶段生成设计文档

## 概述

本设计文档描述了在 ai-sketch 项目中实现"需求提取 LLM 两阶段生成"功能的架构和实现方案。

### 问题陈述

当用户输入长文章或复杂描述时，直接发送给生图 LLM 可能导致：
1. 噪声干扰：解释性文字、背景知识等对图表生成无帮助
2. 细节遗漏：LLM 可能无法从大量文字中正确提取图表要素
3. 多图混淆：多个图表需求混在一起，不知道要生成几张图

### 解决方案

在生图 LLM 之前插入一个"需求提取 LLM"，将用户的任意输入转化为最适合生图的结构化提示词，同时评估图表的复杂度。

## 架构设计

### 当前架构（单阶段）

```
用户输入 → API Route → 构建消息 → 调用 LLM → 返回结果 → 缓存
```

### 改造后架构（两阶段 Pipeline）

```
用户输入 → API Route → 需求提取 LLM → 获取结构化需求 + 复杂度评估
                           ↓
                      模式判断（基于 complexity）
                           ↓
                      检查缓存 → 命中? → 返回缓存结果
                           ↓ 未命中
                      构建消息（使用提取后的需求）
                           ↓
                      调用生图 LLM → 返回结果 → 缓存结果
```

### 关键设计决策

1. **触发条件**：总是触发需求提取（除图片输入、重新生成、编辑模式外）
2. **缓存策略**：基于提取后的需求和实际模式缓存
3. **LLM 配置**：使用与生图相同的配置
4. **输出格式**：JSON 格式（使用 structured output）
5. **复杂度评估**：LLM 同时返回 complexity 字段
6. **多图拆分**：不拆分，用户手动分次
7. **数据库存储**：只存原始输入，不存提取后的提示词

## 详细设计

### 1. 需求提取 LLM 的 System Prompt

```typescript
const EXTRACTION_SYSTEM_PROMPT = `你是一个图表需求分析专家。你的任务是从用户的输入中提取出最适合生成图表的结构化描述，并评估图表的复杂度。

## 输入
用户可能提供以下类型的内容：
- 长文章、教程、文档
- 简短的需求描述
- 混合内容（解释性文字 + 结构化信息）

## 输出要求
你必须返回一个 JSON 对象，包含以下字段：
- requirement: 提取后的结构化图表描述（字符串）
- complexity: 复杂度评估，只能是 "simple"、"medium" 或 "complex"

## 复杂度评估标准
- **simple（简单）**：5 个以下节点，简单线性流程，无分支或少量分支
- **medium（中等）**：5-15 个节点，有分支和合并，中等复杂度的关系
- **complex（复杂）**：15 个以上节点，多层次结构，复杂的关系网络，或需要详细布局的图表

## 图表描述的写作规范
1. **明确实体**：列出图表中的所有节点/元素
2. **明确关系**：节点之间的连接、依赖、包含关系
3. **明确流程**：如果是流程图，按步骤列出
4. **明确层次**：如果是层次图，说明层级结构
5. **去除噪声**：忽略解释性文字、背景知识、数字细节（除非图表需要）
6. **语言跟随**：使用与输入相同的语言

## 示例
输入："用户登录时，前端验证格式，然后调用API，后端查数据库，成功返回token，失败返回错误。注册流程类似，但需要邮箱验证。"
输出：
{
  "requirement": "创建用户登录流程图，包含以下步骤：\\n1. 用户输入用户名和密码\\n2. 前端验证输入格式\\n3. 格式合法则调用后端API\\n4. 后端查询数据库验证用户信息\\n5. 验证成功：生成JWT token，返回前端，跳转首页\\n6. 验证失败：返回错误信息\\"用户名或密码错误\\"\\n\\n包含注册分支：新用户可点击注册，填写邮箱、用户名、密码，后端验证邮箱唯一性后创建账号。",
  "complexity": "medium"
}`;
```

### 2. Structured Output

使用 JSON Schema 确保 LLM 返回符合要求的 JSON 格式：

```typescript
const EXTRACTION_JSON_SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name: 'extraction_result',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        requirement: {
          type: 'string',
          description: '提取后的结构化图表描述',
        },
        complexity: {
          type: 'string',
          enum: ['simple', 'medium', 'complex'],
          description: '图表复杂度评估',
        },
      },
      required: ['requirement', 'complexity'],
      additionalProperties: false,
    },
  },
};
```

**各 Provider 的支持情况**：

| Provider | Structured Output | 说明 |
|----------|------------------|------|
| **OpenAI** | ✅ 支持 | 使用 `response_format` 参数 |
| **Anthropic** | ❌ 不支持 | 忽略 `responseFormat`，依赖 System Prompt |
| **Ollama** | ✅ 支持 | 继承 OpenAI，使用 `response_format` 参数 |

### 3. 缓存策略

#### 缓存键生成

```typescript
// 使用提取后的需求和实际模式计算缓存键
const cacheKey = await buildCacheKey({
  prompt: strategy.getUserPrompt(requirementForLLM, chartType),  // 提取后的需求
  format: diagramFormat,
  chartType,
  model: config.model,
  configName: config.name || config.type,
  contextHash,
  mode: effectiveMode,  // 实际的生成模式
});
```

#### 缓存检查时机

```typescript
// 1. 先进行需求提取
const extractionResult = await extractRequirements(userContent, config, signal);
const requirementForLLM = extractionResult.requirement;

// 2. 判断模式
const effectiveMode = extractionResult.complexity === 'complex' ? 'quality' : 'fast';

// 3. 检查缓存（基于提取后的需求和实际模式）
const cacheKey = await buildCacheKey({
  prompt: strategy.getUserPrompt(requirementForLLM, chartType),
  format: diagramFormat,
  chartType,
  model: config.model,
  configName: config.name || config.type,
  contextHash,
  mode: effectiveMode,
});
const cachedResponse = await cacheManager.get(cacheKey);

if (cachedResponse) {
  // 命中缓存，直接返回
  return streamResponse(cachedResponse);
}

// 4. 未命中缓存，调用生图 LLM
const result = await generateDiagram(requirementForLLM, strategy, config);

// 5. 缓存结果
await cacheManager.set(cacheKey, result, { configName, model });
```

#### 缓存条件

与当前逻辑保持一致：
- ✅ 纯文本输入：缓存
- ✅ 降级模式（图片转文字）：缓存
- ❌ Vision 模式（带图片）：不缓存
- ❌ 重新生成：不缓存
- ❌ 编辑模式：不缓存

### 4. 数据库存储

#### 存储内容

```typescript
// 用户消息表：存储用户原始输入（不存储提取后的提示词）
await conversationManager.addMessage({
  conversationId: activeConversationId,
  role: 'user',
  content: userContent,  // 用户原始输入
  sourceType: 'text',
});
```

#### 存储时机

在调用需求提取 LLM **之前**存储用户消息，这样即使需求提取失败，用户输入也不会丢失。

#### 上下文构建

在构建上下文消息时，使用用户原始输入（而不是提取后的提示词）：

```typescript
// 构建上下文消息（用于多轮对话）
const contextMessages = skipContext
  ? []
  : await conversationManager.buildContextMessages(activeConversationId);

// 最后一条消息是用户原始输入，替换为提取后的需求（仅用于本次生图）
if (contextMessages.length > 0 && contextMessages[contextMessages.length - 1].role === 'user') {
  contextMessages[contextMessages.length - 1] = {
    role: 'user',
    content: requirementForLLM,  // 使用提取后的需求
  };
}
```

### 5. 错误处理

#### 需求提取 LLM 失败

如果需求提取 LLM 调用失败，**降级到直接使用用户原始输入**：

```typescript
let requirementForLLM: string;
let extractionResult: ExtractionResult | null = null;

try {
  extractionResult = await extractRequirements(userContent, config, combinedController.signal);
  requirementForLLM = extractionResult.requirement;
} catch (error) {
  console.error('[Generate] 需求提取失败，降级使用原始输入:', error);
  // 降级：直接使用用户原始输入
  requirementForLLM = userContent;
  extractionResult = null;
}
```

#### 模式判断降级

如果需求提取失败，使用长度判断作为降级方案：

```typescript
let effectiveMode: Exclude<GenerationMode, 'auto'> = 'fast';
if (generationMode === 'auto') {
  if (extractionResult) {
    // 使用 LLM 的复杂度评估
    effectiveMode = extractionResult.complexity === 'complex' ? 'quality' : 'fast';
  } else {
    // 降级：使用简单长度判断
    effectiveMode = userContent.length >= 500 ? 'quality' : 'fast';
  }
} else if (generationMode === 'quality') {
  effectiveMode = 'quality';
}
```

#### 生图 LLM 失败

生图 LLM 失败时，保持现有的重试机制：

```typescript
const maxRetries = await configManager.getMaxRetries();
let lastError: unknown = null;

for (let attempt = 0; attempt <= maxRetries; attempt++) {
  try {
    // 调用生图 LLM
    const result = await callLLM(config, fullMessages, onChunk, signal);
    lastError = null;
    break;
  } catch (err) {
    lastError = err;
    if (!isRetryableError(err) || attempt >= maxRetries) break;
  }
}

if (lastError) throw lastError;
```

#### 用户取消

用户取消时，同时取消需求提取和生图 LLM 调用：

```typescript
// 使用同一个 AbortController 控制两个 LLM 调用
const combinedController = new AbortController();

// 需求提取 LLM
const extractionResult = await extractRequirements(
  userContent, config, combinedController.signal
);

// 生图 LLM
const result = await generateDiagram(
  extractionResult.requirement, strategy, config, combinedController.signal
);
```

## 实现步骤

### 步骤 1：创建需求提取模块

创建 `lib/generation/requirement-extractor.ts`：

```typescript
import type { LLMConfig, LLMMessage } from '@/lib/types';
import { callLLM } from '@/lib/llm/client';

/** 需求提取结果 */
export interface ExtractionResult {
  requirement: string;
  complexity: 'simple' | 'medium' | 'complex';
}

/** JSON Schema 用于 structured output */
const EXTRACTION_JSON_SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name: 'extraction_result',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        requirement: { type: 'string', description: '提取后的结构化图表描述' },
        complexity: { type: 'string', enum: ['simple', 'medium', 'complex'], description: '图表复杂度评估' },
      },
      required: ['requirement', 'complexity'],
      additionalProperties: false,
    },
  },
};

const EXTRACTION_SYSTEM_PROMPT = `你是一个图表需求分析专家...`;

export async function extractRequirements(
  userInput: string,
  config: LLMConfig,
  signal?: AbortSignal,
): Promise<ExtractionResult> {
  if (!userInput || !userInput.trim()) {
    throw new Error('用户输入不能为空');
  }

  const messages: LLMMessage[] = [
    { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
    { role: 'user', content: userInput },
  ];

  // 使用 structured output 确保返回 JSON 格式
  let result = '';
  await callLLM(config, messages, (chunk) => {
    result += chunk;
  }, signal, EXTRACTION_JSON_SCHEMA);

  const trimmed = result.trim();
  if (!trimmed) {
    throw new Error('LLM 返回内容为空');
  }

  // 解析 JSON 结果
  const parsed = JSON.parse(trimmed);
  if (!parsed.requirement || typeof parsed.requirement !== 'string') {
    throw new Error('requirement 字段缺失或类型错误');
  }
  if (!parsed.complexity || !['simple', 'medium', 'complex'].includes(parsed.complexity)) {
    throw new Error('complexity 字段缺失或值无效');
  }

  return {
    requirement: parsed.requirement,
    complexity: parsed.complexity,
  };
}
```

### 步骤 2：修改 LLM 客户端

修改 `lib/llm/client.ts`，添加 `responseFormat` 参数支持：

```typescript
export async function callLLM(
  config: LLMConfig,
  messages: LLMMessage[],
  onChunk?: (chunk: string) => void,
  signal?: AbortSignal,
  responseFormat?: object,  // 新增参数
): Promise<string> {
  // ...
  const body = provider.buildRequestBody(model, messages, temperature, maxTokens, responseFormat);
  // ...
}
```

### 步骤 3：修改 /api/generate 路由

在 `app/api/generate/route.ts` 中：

1. 先进行需求提取
2. 基于提取结果判断模式
3. 使用提取后的需求和实际模式计算缓存键
4. 检查缓存
5. 如果缓存未命中，调用生图 LLM

### 步骤 4：测试验证

1. **短文本输入**：验证需求提取是否正常工作
2. **长文章输入**：验证是否能正确提取图表需求
3. **缓存命中**：验证相同输入是否能命中缓存
4. **缓存未命中**：验证不同输入是否能正确调用需求提取
5. **错误降级**：验证需求提取失败时是否能降级到原始输入
6. **用户取消**：验证取消操作是否能同时取消两个 LLM 调用
7. **Structured Output**：验证 OpenAI provider 是否正确返回 JSON 格式

## 性能考虑

### 延迟影响

- **缓存命中**：无额外延迟
- **缓存未命中**：增加一次 LLM 调用（约 2-5 秒）

### 成本影响

- **缓存命中**：无额外成本
- **缓存未命中**：增加一次 LLM 调用的 token 消耗

### 优化建议

1. **并行调用**：如果未来需要支持多图拆分，可以考虑并行调用多个生图 LLM
2. **缓存优化**：如果需求提取 LLM 调用频繁，可以考虑单独缓存提取结果
3. **模型选择**：如果需求提取 LLM 调用成本高，可以考虑使用更轻量的模型

## 未来扩展

### 多图拆分

如果需要支持多图拆分，可以：
1. 修改需求提取 LLM 的 System Prompt，使其输出多个图表需求
2. 在前端展示图表列表，让用户选择
3. 逐个调用生图 LLM 生成图表

### 语义相似度缓存

如果需要支持相似输入的缓存命中，可以：
1. 使用向量数据库存储输入的语义表示
2. 计算新输入与缓存输入的相似度
3. 如果相似度超过阈值，命中缓存

## 参考文件

| 文件 | 用途 |
|------|------|
| `app/api/generate/route.ts` | API 端点，协调整个流程 |
| `lib/generation/requirement-extractor.ts` | 需求提取模块（新增） |
| `lib/generation/complexity-assessor.ts` | 复杂度评估（降级方案） |
| `lib/llm/client.ts` | LLM 客户端（支持 structured output） |
| `lib/llm/providers/openai.ts` | OpenAI provider（支持 response_format） |
| `lib/llm/providers/anthropic.ts` | Anthropic provider（不支持 structured output） |
| `lib/llm/providers/ollama.ts` | Ollama provider（继承 OpenAI） |
| `lib/db/cache-manager.ts` | 缓存管理器 |
| `lib/cache/cache-key.ts` | 缓存键生成 |
| `lib/db/conversation-manager.ts` | 会话管理器 |
| `lib/strategies/registry.ts` | 策略注册表 |

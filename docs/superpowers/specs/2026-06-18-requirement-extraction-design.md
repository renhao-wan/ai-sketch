# 需求提取 LLM 两阶段生成设计文档

## 概述

本设计文档描述了在 ai-sketch 项目中实现"需求提取 LLM 两阶段生成"功能的架构和实现方案。

### 问题陈述

当用户输入长文章或复杂描述时，直接发送给生图 LLM 可能导致：
1. 噪声干扰：解释性文字、背景知识等对图表生成无帮助
2. 细节遗漏：LLM 可能无法从大量文字中正确提取图表要素
3. 多图混淆：多个图表需求混在一起，不知道要生成几张图

### 解决方案

在生图 LLM 之前插入一个"需求提取 LLM"，将用户的任意输入转化为最适合生图的结构化提示词。

## 架构设计

### 当前架构（单阶段）

```
用户输入 → API Route → 构建消息 → 调用 LLM → 返回结果 → 缓存
```

### 改造后架构（两阶段）

```
用户输入 → API Route → 检查缓存 → 命中? → 返回缓存结果
                           ↓ 未命中
                      调用需求提取 LLM → 获取优化后的提示词
                           ↓
                      构建消息（使用提取后的提示词）
                           ↓
                      调用生图 LLM → 返回结果 → 缓存结果
```

### 关键设计决策

1. **触发条件**：总是触发需求提取（所有模式：快速、自动、高质量）
2. **缓存策略**：基于原始输入缓存（命中缓存后跳过需求提取和生图）
3. **LLM 配置**：使用与生图相同的配置
4. **输出格式**：纯文本提示词
5. **多图拆分**：不拆分，用户手动分次
6. **数据库存储**：只存原始输入，不存提取后的提示词

## 详细设计

### 1. 需求提取 LLM 的 System Prompt

```typescript
const EXTRACTION_SYSTEM_PROMPT = `你是一个图表需求分析专家。你的任务是从用户的输入中提取出最适合生成图表的结构化描述。

## 输入
用户可能提供以下类型的内容：
- 长文章、教程、文档
- 简短的需求描述
- 混合内容（解释性文字 + 结构化信息）

## 输出要求
直接输出一个清晰、结构化的图表描述（50-300字），用于指导图表生成。

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
创建用户登录流程图，包含以下步骤：
1. 用户输入用户名和密码
2. 前端验证输入格式
3. 格式合法则调用后端API
4. 后端查询数据库验证用户信息
5. 验证成功：生成JWT token，返回前端，跳转首页
6. 验证失败：返回错误信息"用户名或密码错误"

包含注册分支：新用户可点击注册，填写邮箱、用户名、密码，后端验证邮箱唯一性后创建账号。`;
```

### 2. 缓存策略

#### 缓存键生成

```typescript
const cacheKey = await buildCacheKey({
  prompt: typeof userInput === 'string' ? userInput : userInput.text,  // 原始输入
  format: diagramFormat,
  chartType,
  model: config.model,
  configName: config.name || config.type,
  contextHash,
  mode: effectiveMode,
});
```

#### 缓存检查时机

```typescript
// 1. 先检查缓存
const cachedResponse = await cacheManager.get(cacheKey);

if (cachedResponse) {
  // 命中缓存，直接返回，跳过需求提取和生图
  return streamResponse(cachedResponse);
}

// 2. 未命中缓存，调用需求提取 LLM
const extractedRequirement = await extractRequirements(userInput, config);

// 3. 调用生图 LLM
const result = await generateDiagram(extractedRequirement, strategy, config);

// 4. 缓存结果
await cacheManager.set(cacheKey, result, { configName, model });
```

#### 缓存条件

与当前逻辑保持一致：
- ✅ 纯文本输入：缓存
- ✅ 降级模式（图片转文字）：缓存
- ❌ Vision 模式（带图片）：不缓存
- ❌ 重新生成：不缓存
- ❌ 编辑模式：不缓存

### 3. 数据库存储

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

// 最后一条消息是用户原始输入，替换为提取后的提示词（仅用于本次生图）
if (contextMessages.length > 0 && contextMessages[contextMessages.length - 1].role === 'user') {
  contextMessages[contextMessages.length - 1] = {
    role: 'user',
    content: extractedRequirement,  // 使用提取后的提示词
  };
}
```

### 4. 错误处理

#### 需求提取 LLM 失败

如果需求提取 LLM 调用失败，**降级到直接使用用户原始输入**：

```typescript
let extractedRequirement: string;

try {
  // 尝试调用需求提取 LLM
  extractedRequirement = await extractRequirements(userInput, config);
} catch (error) {
  console.error('[Generate] 需求提取失败，降级使用原始输入:', error);
  // 降级：直接使用用户原始输入
  extractedRequirement = typeof userInput === 'string' ? userInput : (userInput.text || '');
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
const extractedRequirement = await extractRequirements(
  userInput, config, combinedController.signal
);

// 生图 LLM
const result = await generateDiagram(
  extractedRequirement, strategy, config, combinedController.signal
);
```

## 实现步骤

### 步骤 1：创建需求提取模块

创建 `lib/generation/requirement-extractor.ts`：

```typescript
import type { LLMConfig, LLMMessage } from '@/lib/types';
import { callLLM } from '@/lib/llm/client';

const EXTRACTION_SYSTEM_PROMPT = `你是一个图表需求分析专家...`;

export async function extractRequirements(
  userInput: string,
  config: LLMConfig,
  signal?: AbortSignal,
): Promise<string> {
  const messages: LLMMessage[] = [
    { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
    { role: 'user', content: userInput },
  ];

  let result = '';
  await callLLM(config, messages, (chunk) => {
    result += chunk;
  }, signal);

  return result.trim();
}
```

### 步骤 2：修改 /api/generate 路由

在 `app/api/generate/route.ts` 中：

1. 在缓存检查后、生图 LLM 调用前，插入需求提取 LLM 调用
2. 使用提取后的提示词构建生图 LLM 的消息
3. 添加降级逻辑（需求提取失败时使用原始输入）

### 步骤 3：测试验证

1. **短文本输入**：验证需求提取是否正常工作
2. **长文章输入**：验证是否能正确提取图表需求
3. **缓存命中**：验证相同输入是否能命中缓存
4. **缓存未命中**：验证不同输入是否能正确调用需求提取
5. **错误降级**：验证需求提取失败时是否能降级到原始输入
6. **用户取消**：验证取消操作是否能同时取消两个 LLM 调用

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
| `app/api/generate/route.ts` | API 端点，需要修改 |
| `lib/generation/complexity-assessor.ts` | 复杂度评估，可参考 |
| `lib/db/cache-manager.ts` | 缓存管理器 |
| `lib/cache/cache-key.ts` | 缓存键生成 |
| `lib/db/conversation-manager.ts` | 会话管理器 |
| `lib/llm/client.ts` | LLM 客户端 |
| `lib/strategies/registry.ts` | 策略注册表 |

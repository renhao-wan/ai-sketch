# 需求提取 LLM 两阶段生成实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 ai-sketch 项目中实现"需求提取 LLM 两阶段生成"功能，将用户的任意输入转化为最适合生图的结构化提示词。

**Architecture:** 在 `/api/generate` 路由中，缓存检查后、生图 LLM 调用前，插入需求提取 LLM 调用。使用同一个 LLM 配置，先调用需求提取 LLM 获取优化后的提示词，再调用生图 LLM 生成图表。基于原始输入缓存，命中缓存后直接返回。

**Tech Stack:** Next.js 16 (App Router), TypeScript, SQLite (sql.js), SSE

---

## 文件结构

### 新增文件
- `lib/generation/requirement-extractor.ts` — 需求提取模块，包含 System Prompt 和提取逻辑

### 修改文件
- `app/api/generate/route.ts` — API 端点，插入需求提取 LLM 调用

### 测试文件
- 无（项目未配置测试框架）

---

## Task 1: 创建需求提取模块

**Files:**
- Create: `lib/generation/requirement-extractor.ts`

- [ ] **Step 1: 创建需求提取模块文件**

创建 `lib/generation/requirement-extractor.ts`，包含需求提取的 System Prompt 和提取函数：

```typescript
/**
 * 需求提取模块
 * 将用户的任意输入转化为最适合生图的结构化提示词
 */

import type { LLMConfig, LLMMessage } from '@/lib/types';
import { callLLM } from '@/lib/llm/client';

/** 需求提取的 System Prompt */
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

/**
 * 从用户输入中提取图表需求
 * @param userInput 用户原始输入
 * @param config LLM 配置
 * @param signal AbortSignal，用于取消请求
 * @returns 提取后的结构化提示词
 */
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

- [ ] **Step 2: 验证文件创建成功**

运行以下命令验证文件存在：

```bash
ls -la lib/generation/requirement-extractor.ts
```

预期输出：文件存在，包含需求提取模块代码。

- [ ] **Step 3: 提交代码**

```bash
git add lib/generation/requirement-extractor.ts
git commit -m "feat(generation): 添加需求提取模块"
```

---

## Task 2: 修改 /api/generate 路由

**Files:**
- Modify: `app/api/generate/route.ts`

- [ ] **Step 1: 导入需求提取模块**

在 `app/api/generate/route.ts` 的顶部添加导入语句：

```typescript
import { extractRequirements } from '@/lib/generation/requirement-extractor';
```

- [ ] **Step 2: 在缓存检查后插入需求提取逻辑**

找到以下代码（约第 295-298 行）：

```typescript
if (cachedResponse) {
  console.log('[Generate] Cache hit');
}
```

在其后添加需求提取逻辑：

```typescript
// ── 需求提取（缓存未命中时调用）──
let extractedRequirement: string;

if (cachedResponse) {
  // 缓存命中，跳过需求提取
  extractedRequirement = '';  // 不会被使用
} else {
  // 缓存未命中，调用需求提取 LLM
  perfMark('Requirement Extraction');
  try {
    const userInputText = typeof userInput === 'string' ? userInput : (userInput.text || '');
    extractedRequirement = await extractRequirements(userInputText, config, combinedController.signal);
    console.log(`[Generate] Requirement extracted, length: ${extractedRequirement.length}`);
  } catch (error) {
    console.error('[Generate] 需求提取失败，降级使用原始输入:', error);
    // 降级：直接使用用户原始输入
    extractedRequirement = typeof userInput === 'string' ? userInput : (userInput.text || '');
  }
  perfEnd('Requirement Extraction');
}
```

- [ ] **Step 3: 修改构建 LLM 消息的逻辑**

找到构建 `newUserMessage` 的代码（约第 215-237 行），修改为使用提取后的提示词：

```typescript
// Build the new user message for LLM
let newUserMessage: LLMMessage;
if (processedImages) {
  newUserMessage = {
    role: 'user',
    content: strategy.getUserPrompt(userContent, chartType),
    images: processedImages,
  };
} else if (imageDescription) {
  newUserMessage = {
    role: 'user',
    content: strategy.getUserPrompt(
      `[图片内容]\n${imageDescription}\n\n${userContent}`,
      chartType,
    ),
  };
} else {
  // 使用提取后的提示词（如果有），否则使用原始输入
  const promptForLLM = cachedResponse
    ? (typeof userInput === 'string' ? userInput : (userInput.text || ''))
    : (extractedRequirement || (typeof userInput === 'string' ? userInput : (userInput.text || '')));
  
  newUserMessage = {
    role: 'user',
    content: strategy.getUserPrompt(promptForLLM, chartType),
  };
}
```

- [ ] **Step 4: 修改高质量模式的调用逻辑**

找到高质量模式的代码（约第 338-347 行），修改为使用提取后的提示词：

```typescript
} else if (effectiveMode === 'quality') {
  // 高质量模式：多轮生成
  const promptForQuality = cachedResponse
    ? userContent
    : (extractedRequirement || userContent);
  
  const plan = await generatePlan(config!, promptForQuality, diagramFormat, contextMessages, combinedController.signal);
  console.log(`[Generate] Plan: ${plan.complexity}, ${plan.steps.length} steps, ~${plan.estimatedNodes} nodes`);

  optimizedCode = await executeMultiPass(
    config!, plan, promptForQuality, diagramFormat, contextMessages,
    (event) => controller.enqueue(encoder.encode(event)),
    combinedController.signal,
  );
}
```

- [ ] **Step 5: 验证修改正确**

检查修改后的代码：
1. 导入语句正确
2. 需求提取逻辑在缓存检查后执行
3. 构建 LLM 消息时使用提取后的提示词
4. 高质量模式也使用提取后的提示词

- [ ] **Step 6: 提交代码**

```bash
git add app/api/generate/route.ts
git commit -m "feat(api): 集成需求提取 LLM 两阶段生成"
```

---

## Task 3: 测试验证

**Files:**
- 无新增文件

- [ ] **Step 1: 启动开发服务器**

```bash
cd ai-sketch
pnpm dev
```

等待服务器启动完成。

- [ ] **Step 2: 测试短文本输入**

在浏览器中打开 http://localhost:3000，输入以下内容：

```
创建一个用户登录流程图，包含：输入用户名密码、验证、成功跳转首页、失败显示错误。
```

验证：
1. 需求提取 LLM 被调用（查看控制台日志）
2. 图表正常生成
3. 结果被缓存

- [ ] **Step 3: 测试长文章输入**

输入以下长文章（模拟从文档复制的内容）：

```
## 第一章：存储层次与缓存行（Cache Line）

CPU 核心频率约为 3~5GHz，执行一条简单指令仅需 0.2~0.3 纳秒。而主流 DDR5 内存的访问延迟约为 80~100 纳秒。这意味着如果 CPU 直接去内存取数据，它会空转 300~400 个时钟周期。

- L1 缓存（32KB 指令 + 32KB 数据）：访问延迟 ~1ns（4 个周期），每核独享，紧贴核心。
- L2 缓存（256KB ~ 512KB）：访问延迟 ~3ns（12 个周期），每核独享。
- L3 缓存（8MB ~ 128MB）：访问延迟 ~10ns（40 个周期），多核共享（通过环形总线或网格互联）。
- 主存（DRAM）：访问延迟 ~80ns+。
```

验证：
1. 需求提取 LLM 被调用
2. 提取后的提示词结构清晰（查看控制台日志）
3. 图表正常生成

- [ ] **Step 4: 测试缓存命中**

重复步骤 2 的输入，验证：
1. 缓存命中（查看控制台日志：`[Generate] Cache hit`）
2. 需求提取 LLM 未被调用
3. 图表正常返回

- [ ] **Step 5: 测试错误降级**

模拟需求提取 LLM 失败：
1. 在 `extractRequirements` 函数中添加 `throw new Error('Test error')`
2. 重新测试短文本输入
3. 验证降级到原始输入（查看控制台日志：`[Generate] 需求提取失败，降级使用原始输入`）
4. 图表正常生成
5. 移除测试代码

- [ ] **Step 6: 提交最终代码**

```bash
git add -A
git commit -m "test: 验证需求提取 LLM 两阶段生成功能"
```

---

## 自我审查

### 1. 规范覆盖检查 ✅
- 触发条件：总是触发需求提取（所有模式）— 已实现
- 缓存策略：基于原始输入缓存 — 已实现
- LLM 配置：使用相同配置 — 已实现
- 输出格式：纯文本提示词 — 已实现
- 多图拆分：不拆分，用户手动分次 — 已实现
- 数据库存储：只存原始输入 — 已实现

### 2. 占位符扫描 ✅
- 没有 TBD、TODO 或不完整的部分
- 所有代码示例都是完整的

### 3. 类型一致性检查 ✅
- `extractRequirements` 函数签名一致
- `EXTRACTION_SYSTEM_PROMPT` 常量名称一致
- 变量名 `extractedRequirement` 一致

### 4. 规范需求对照 ✅
- 架构设计：两阶段 pipeline — 已实现
- 缓存策略：基于原始输入缓存 — 已实现
- 数据库存储：只存原始输入 — 已实现
- 错误处理：降级到原始输入 — 已实现
- 实现步骤：清晰可行 — 已实现

**审查结论**：实现计划完整、一致、无歧义，覆盖所有规范需求。

/**
 * 需求提取模块
 * 将用户的任意输入转化为最适合生图的结构化提示词
 * 同时评估图表复杂度，为自动模式提供决策依据
 *
 * 使用 structured output 确保 LLM 返回符合要求的 JSON 格式
 */

import type { LLMConfig, LLMMessage } from '@/lib/types';
import { callLLM } from '@/lib/llm/client';

/** 需求提取结果 */
export interface ExtractionResult {
  /** 提取后的结构化需求描述 */
  requirement: string;
  /** 复杂度评估：simple（简单）、medium（中等）、complex（复杂） */
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

/** 需求提取的 System Prompt */
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

/**
 * 从用户输入中提取图表需求
 * @param userInput 用户原始输入
 * @param config LLM 配置
 * @param signal AbortSignal，用于取消请求
 * @returns 提取结果，包含需求描述和复杂度评估
 */
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
  try {
    const parsed = JSON.parse(trimmed);

    // 验证必要字段
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
  } catch (error) {
    console.error('[RequirementExtractor] JSON 解析失败:', error);
    throw new Error(`需求提取失败: ${(error as Error).message}`);
  }
}

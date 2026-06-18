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
  if (!userInput || !userInput.trim()) {
    throw new Error('用户输入不能为空');
  }

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

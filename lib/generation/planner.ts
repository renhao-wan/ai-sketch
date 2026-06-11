/**
 * 多轮生成的步骤规划器
 * 调用 LLM 评估需求并输出结构化的生成计划
 */

import { callLLM } from '@/lib/llm/client';
import type { LLMConfig, LLMMessage } from '@/lib/types';
import type { DiagramFormat } from '@/lib/types/diagram-strategy';
import type { GenerationPlan } from './types';

const PLANNER_SYSTEM_PROMPT = `你是一个图表生成规划专家。你的任务是分析用户的图表需求，输出一个结构化的生成计划。

你需要判断：
1. 这个图表的复杂度（simple/medium/complex）
2. 预估节点数量
3. 将生成过程拆解为 2-4 个步骤

每个步骤有三种类型：
- nodes: 生成一组节点/形状
- connections: 添加连线/箭头
- style: 样式优化、布局调整

你必须输出严格的 JSON 格式，不要包含任何其他文字：

{
  "complexity": "simple" | "medium" | "complex",
  "estimatedNodes": <数字>,
  "steps": [
    {
      "type": "nodes" | "connections" | "style",
      "description": "这一步要生成什么的详细描述",
      "dependencies": [<依赖的步骤索引>]
    }
  ]
}

规则：
- steps 数组长度必须在 2-4 之间
- 第一步的 dependencies 必须为空数组 []
- 后续步骤的 dependencies 引用之前的步骤索引
- connections 类型的步骤必须依赖至少一个 nodes 步骤
- style 类型的步骤通常依赖 connections 步骤
- description 要足够详细，让 LLM 能根据它生成准确的代码`;

/**
 * 调用 Planner 生成计划
 */
export async function generatePlan(
  config: LLMConfig,
  userInput: string,
  format: DiagramFormat,
  contextMessages: LLMMessage[],
  signal?: AbortSignal,
): Promise<GenerationPlan> {
  const plannerMessages: LLMMessage[] = [
    { role: 'system', content: PLANNER_SYSTEM_PROMPT },
    ...contextMessages.filter(m => m.role !== 'system'),
    {
      role: 'user',
      content: `图表格式：${format}\n用户需求：${userInput}\n\n请输出生成计划 JSON。`,
    },
  ];

  let planJson = '';
  await callLLM(config, plannerMessages, (chunk) => {
    planJson += chunk;
  }, signal);

  // 提取 JSON（处理可能的代码围栏）
  const jsonMatch = planJson.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Planner 未返回有效的 JSON');
  }

  const plan = JSON.parse(jsonMatch[0]) as GenerationPlan;

  // 验证计划结构
  if (!plan.steps || !Array.isArray(plan.steps) || plan.steps.length < 2) {
    throw new Error('Planner 返回的计划步骤不足');
  }

  return plan;
}

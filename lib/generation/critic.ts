/**
 * 生成结果的校验器
 * 规则校验：不消耗 token，检查结构性问题
 * LLM 评审：消耗 token，评估语义和质量
 */

import { callLLM } from '@/lib/llm/client';
import { extractFirstJsonObject } from '@/lib/diagram/json-repair';
import { getStrategy } from '@/lib/strategies/registry';
import type { LLMConfig, LLMMessage } from '@/lib/types';
import type { DiagramFormat } from '@/lib/types/diagram-strategy';
import type { CritiqueResult } from './types';

/** 规则校验：检查代码的结构性问题（委托给各策略的 ruleCheck 方法） */
export function ruleCheck(code: string, format: DiagramFormat): CritiqueResult {
  if (!code || code.trim().length === 0) {
    return { passed: false, issues: ['代码为空'], severity: 'error' };
  }

  const strategy = getStrategy(format);
  if (strategy.ruleCheck) {
    return strategy.ruleCheck(code);
  }

  // 未实现 ruleCheck 的格式默认通过
  return { passed: true, issues: [], severity: 'warning' };
}

/** LLM 评审：评估生成结果的质量 */
export async function llmCritique(
  config: LLMConfig,
  userInput: string,
  code: string,
  format: DiagramFormat,
  ruleIssues: string[],
  signal?: AbortSignal,
): Promise<{ issues: string[]; fixedCode: string | null }> {
  const critiqueMessages: LLMMessage[] = [
    {
      role: 'system',
      content: `你是一个图表代码质量评审专家。检查以下代码的问题并给出修复建议。

输出严格的 JSON 格式，不要包含其他文字：
{
  "issues": ["问题1", "问题2"],
  "fixedCode": "修复后的完整代码，如果没有需要修复的则为 null"
}`,
    },
    {
      role: 'user',
      content: `用户需求：${userInput}
图表格式：${format}
规则校验发现的问题：${ruleIssues.join(', ') || '无'}

当前代码：
${code}

请评审并输出 JSON。`,
    },
  ];

  let responseJson = '';
  await callLLM(config, critiqueMessages, (chunk) => {
    responseJson += chunk;
  }, signal);

  // 使用带字符串状态追踪的括号平衡匹配提取 JSON
  const jsonStr = extractFirstJsonObject(responseJson);
  if (!jsonStr) {
    return { issues: ['LLM 评审未返回有效 JSON'], fixedCode: null };
  }

  try {
    const result = JSON.parse(jsonStr);
    return {
      issues: Array.isArray(result.issues) ? result.issues : [],
      fixedCode: result.fixedCode || null,
    };
  } catch {
    return { issues: ['LLM 评审返回的 JSON 解析失败'], fixedCode: null };
  }
}

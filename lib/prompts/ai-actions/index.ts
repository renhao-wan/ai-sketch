/**
 * AI 操作提示词模块
 */

export { LAYOUT_SYSTEM_PROMPT } from './layout';
export { BEAUTIFY_SYSTEM_PROMPT } from './beautify';
export { SIMPLIFY_SYSTEM_PROMPT } from './simplify';
export { EXPLAIN_SYSTEM_PROMPT, buildExplainUserPrompt } from './explain';

import { LAYOUT_SYSTEM_PROMPT } from './layout';
import { BEAUTIFY_SYSTEM_PROMPT } from './beautify';
import { SIMPLIFY_SYSTEM_PROMPT } from './simplify';
import { EXPLAIN_SYSTEM_PROMPT, buildExplainUserPrompt } from './explain';
import type { DiagramFormat, AIActionType } from '../types';

/** AI 操作动词映射 */
const ACTION_VERBS: Record<AIActionType, string> = {
  layout: '优化布局',
  beautify: '美化',
  simplify: '简化',
  explain: '解释',
};

/** AI 操作系统提示词映射 */
const ACTION_SYSTEM_PROMPTS: Record<AIActionType, string> = {
  layout: LAYOUT_SYSTEM_PROMPT,
  beautify: BEAUTIFY_SYSTEM_PROMPT,
  simplify: SIMPLIFY_SYSTEM_PROMPT,
  explain: EXPLAIN_SYSTEM_PROMPT,
};

/**
 * 构建 AI 操作用户提示词（通用函数）
 * @param action 操作类型
 * @param code 图表代码
 * @param format 图表格式
 */
export function buildActionUserPrompt(action: AIActionType, code: string, format: string): string {
  // explain 有特殊的提示词格式
  if (action === 'explain') {
    return buildExplainUserPrompt(code, format);
  }
  return `请${ACTION_VERBS[action]}以下 ${format.toUpperCase()} 图表代码：\n\n${code}`;
}

/**
 * 获取 AI 操作系统提示词
 * @param action 操作类型
 * @param format 图表格式
 */
export function getActionSystemPrompt(action: AIActionType, format: DiagramFormat): string {
  return ACTION_SYSTEM_PROMPTS[action];
}

/**
 * 获取 AI 操作用户提示词
 * @param action 操作类型
 * @param code 图表代码
 * @param format 图表格式
 */
export function getActionUserPrompt(action: AIActionType, code: string, format: DiagramFormat): string {
  return buildActionUserPrompt(action, code, format);
}

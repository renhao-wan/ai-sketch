/**
 * AI 操作提示词模块
 */

export { LAYOUT_SYSTEM_PROMPT, buildLayoutUserPrompt } from './layout';
export { BEAUTIFY_SYSTEM_PROMPT, buildBeautifyUserPrompt } from './beautify';
export { SIMPLIFY_SYSTEM_PROMPT, buildSimplifyUserPrompt } from './simplify';
export { EXPLAIN_SYSTEM_PROMPT, buildExplainUserPrompt } from './explain';

import { LAYOUT_SYSTEM_PROMPT, buildLayoutUserPrompt } from './layout';
import { BEAUTIFY_SYSTEM_PROMPT, buildBeautifyUserPrompt } from './beautify';
import { SIMPLIFY_SYSTEM_PROMPT, buildSimplifyUserPrompt } from './simplify';
import { EXPLAIN_SYSTEM_PROMPT, buildExplainUserPrompt } from './explain';
import { DiagramFormat, AIActionType } from '../types';

/** AI 操作系统提示词映射 */
const ACTION_SYSTEM_PROMPTS: Record<AIActionType, string> = {
  layout: LAYOUT_SYSTEM_PROMPT,
  beautify: BEAUTIFY_SYSTEM_PROMPT,
  simplify: SIMPLIFY_SYSTEM_PROMPT,
  explain: EXPLAIN_SYSTEM_PROMPT,
};

/** AI 操作用户提示词构建器映射 */
const ACTION_USER_PROMPT_BUILDERS: Record<AIActionType, (code: string, format: string) => string> = {
  layout: buildLayoutUserPrompt,
  beautify: buildBeautifyUserPrompt,
  simplify: buildSimplifyUserPrompt,
  explain: buildExplainUserPrompt,
};

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
  const builder = ACTION_USER_PROMPT_BUILDERS[action];
  return builder(code, format);
}

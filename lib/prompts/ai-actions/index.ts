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
import type { DiagramFormat } from '../../types/diagram-strategy';
import type { AIActionType } from '../types';

/** AI 操作动词映射 */
const ACTION_VERBS: Record<AIActionType, { verb: string; suffix?: string }> = {
  layout: { verb: '优化', suffix: '的布局' },
  beautify: { verb: '美化' },
  simplify: { verb: '简化' },
  explain: { verb: '解释' },
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

  // 代码大小限制：防止超大代码嵌入 prompt 导致超出 LLM 上下文窗口
  const MAX_CODE_LENGTH = 80000;
  const truncatedCode = code.length > MAX_CODE_LENGTH
    ? code.substring(0, MAX_CODE_LENGTH) + '\n\n// ... [代码过长，已截断] ...'
    : code;

  const { verb, suffix } = ACTION_VERBS[action];
  return `请${verb}以下 ${format.toUpperCase()} 图表代码${suffix || ''}：\n\n${truncatedCode}`;
}

/**
 * 获取 AI 操作系统提示词
 * 当前各格式共享同一套 AI 操作系统提示词（美化/布局/简化/解释不依赖格式）
 * 保留 format 参数以备未来按格式区分
 * @param action 操作类型
 * @param format 图表格式
 */
export function getActionSystemPrompt(action: AIActionType, _format: DiagramFormat): string {
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

/**
 * 自动模式的复杂度评估
 * 根据用户输入和格式判断应该走快速还是高质量模式
 *
 * 设计原则：
 * - 基于输入长度判断复杂度，简单且通用
 * - 长文本通常意味着更复杂的图表需求
 * - 需求提取后，复杂描述会被提炼为更长的结构化描述
 * - Mermaid 始终使用快速模式（布局由渲染器处理）
 */

import type { DiagramFormat } from '@/lib/types/diagram-strategy';
import type { GenerationMode } from './types';

/**
 * 高质量模式的长度阈值（字符数）
 * 基于需求提取后的描述长度判断
 * - < 200 字符：简单图表，使用快速模式
 * - 200-500 字符：中等复杂度，使用快速模式
 * - > 500 字符：复杂图表，使用高质量模式
 */
const QUALITY_LENGTH_THRESHOLD = 500;

/** 评估复杂度，返回 'fast' 或 'quality' */
export function assessComplexity(
  userInput: string,
  format: DiagramFormat,
): Exclude<GenerationMode, 'auto'> {
  // 规则 1：Mermaid 始终快速
  // Mermaid 布局由渲染器处理，多轮生成收益低
  if (format === 'mermaid') return 'fast';

  // 规则 2：基于输入长度判断
  // 长文本通常意味着更复杂的图表需求
  const length = userInput.trim().length;
  return length >= QUALITY_LENGTH_THRESHOLD ? 'quality' : 'fast';
}

/**
 * 计算复杂度评分（保留用于日志和调试）
 * 基于输入长度，返回 0-10 的评分
 */
export function calculateComplexityScore(input: string): number {
  const length = input.trim().length;

  // 将长度映射到 0-10 的评分
  if (length >= 1000) return 10;
  if (length >= 800) return 9;
  if (length >= 600) return 8;
  if (length >= 500) return 7;
  if (length >= 400) return 6;
  if (length >= 300) return 5;
  if (length >= 200) return 4;
  if (length >= 100) return 3;
  if (length >= 50) return 2;
  if (length >= 20) return 1;
  return 0;
}

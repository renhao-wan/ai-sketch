/**
 * 自动模式的复杂度评估
 * 根据用户输入和格式判断应该走快速还是高质量模式
 */

import type { DiagramFormat } from '@/lib/types/diagram-strategy';
import type { GenerationMode } from './types';

/** 评估复杂度，返回 'fast' 或 'quality' */
export function assessComplexity(
  userInput: string,
  format: DiagramFormat,
): Exclude<GenerationMode, 'auto'> {
  // 规则 1：Mermaid 始终快速
  // Mermaid 布局由渲染器处理，多轮生成收益低
  if (format === 'mermaid') return 'fast';

  // 规则 2：评分 >= 12 走高质量
  const score = calculateComplexityScore(userInput);
  return score >= 12 ? 'quality' : 'fast';
}

/** 计算复杂度评分 */
export function calculateComplexityScore(input: string): number {
  let score = 0;
  const lower = input.toLowerCase();

  // 数量指标：提取描述中的数字，取最大值
  const numberMatches = lower.match(/\d+/g);
  if (numberMatches) {
    const maxNum = Math.max(...numberMatches.map(Number));
    if (maxNum >= 20) score += 6;
    else if (maxNum >= 10) score += 4;
    else if (maxNum >= 5) score += 2;
  }

  // 关系密度指标：连接词
  const relationWords = [
    '连接', '依赖', '调用', '关联', '交互', '通信',
    'connect', 'depend', 'call', 'interact', 'communicate',
  ];
  for (const word of relationWords) {
    if (lower.includes(word)) score += 1;
  }

  // 结构复杂度指标
  const complexityIndicators = [
    '架构', '微服务', '分层', '组件', '模块', '子系统',
    'architecture', 'microservice', 'layer', 'component', 'module', 'subsystem',
    '流程图', '时序图', '类图', 'er图', '拓扑',
    'flowchart', 'sequence', 'class diagram', 'er diagram', 'topology',
    '数据库', '表', '字段', 'database', 'table', 'field',
  ];
  for (const indicator of complexityIndicators) {
    if (lower.includes(indicator)) score += 2;
  }

  // 分区/分组指标
  const groupIndicators = [
    '分为', '包括', '包含',
    'consist', 'include', 'contain', 'composed of', 'divided into',
  ];
  for (const indicator of groupIndicators) {
    if (lower.includes(indicator)) score += 2;
  }

  return score;
}

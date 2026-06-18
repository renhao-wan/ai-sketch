/**
 * 自动模式的复杂度评估
 * 根据用户输入和格式判断应该走快速还是高质量模式
 *
 * 设计原则：
 * - 引入需求提取后，大部分复杂输入会被提炼为清晰的结构化描述
 * - 因此自动模式应更倾向于快速模式，只在真正复杂时才使用高质量模式
 * - 高质量模式适用于：大量节点、复杂关系、多层次结构的图表
 */

import type { DiagramFormat } from '@/lib/types/diagram-strategy';
import type { GenerationMode } from './types';

/** 高质量模式的复杂度阈值（提高阈值，让自动模式更倾向于快速模式） */
const QUALITY_THRESHOLD = 20;

/** 评估复杂度，返回 'fast' 或 'quality' */
export function assessComplexity(
  userInput: string,
  format: DiagramFormat,
): Exclude<GenerationMode, 'auto'> {
  // 规则 1：Mermaid 始终快速
  // Mermaid 布局由渲染器处理，多轮生成收益低
  if (format === 'mermaid') return 'fast';

  // 规则 2：评分 >= 阈值 走高质量
  const score = calculateComplexityScore(userInput);
  return score >= QUALITY_THRESHOLD ? 'quality' : 'fast';
}

/**
 * 计算复杂度评分
 *
 * 评分维度：
 * 1. 节点数量：从描述中提取数字，推断图表规模
 * 2. 关系密度：连接词数量，推断图表连接复杂度
 * 3. 结构复杂度：架构、分层等关键词，推断图表层次深度
 * 4. 分组指标：包含、分为等关键词，推断图表分组数量
 */
export function calculateComplexityScore(input: string): number {
  let score = 0;
  const lower = input.toLowerCase();

  // 1. 节点数量指标：提取描述中的数字，取最大值
  // 需求提取后，数字通常代表步骤数、节点数等
  const numberMatches = lower.match(/\d+/g);
  if (numberMatches) {
    const maxNum = Math.max(...numberMatches.map(Number));
    if (maxNum >= 30) score += 10;      // 大型图表（30+ 节点）
    else if (maxNum >= 20) score += 7;  // 中大型图表（20-29 节点）
    else if (maxNum >= 10) score += 4;  // 中型图表（10-19 节点）
    else if (maxNum >= 5) score += 2;   // 小型图表（5-9 节点）
  }

  // 2. 关系密度指标：连接词
  // 每个连接词代表一条边，关系越密集越复杂
  const relationWords = [
    '连接', '依赖', '调用', '关联', '交互', '通信', '指向', '流向',
    'connect', 'depend', 'call', 'interact', 'communicate', 'point to', 'flow to',
  ];
  for (const word of relationWords) {
    if (lower.includes(word)) score += 1;
  }

  // 3. 结构复杂度指标
  // 这些关键词通常意味着多层次、多模块的复杂架构
  const complexityIndicators = [
    '架构', '微服务', '分层', '组件', '模块', '子系统', '层次', '层级',
    'architecture', 'microservice', 'layer', 'component', 'module', 'subsystem',
    '流程图', '时序图', '类图', 'er图', '拓扑',
    'flowchart', 'sequence', 'class diagram', 'er diagram', 'topology',
    '数据库', '表', '字段', 'database', 'table', 'field',
  ];
  for (const indicator of complexityIndicators) {
    if (lower.includes(indicator)) score += 2;
  }

  // 4. 分区/分组指标
  // 分组越多，图表越复杂
  const groupIndicators = [
    '分为', '包括', '包含', '分为', '分成',
    'consist', 'include', 'contain', 'composed of', 'divided into',
  ];
  for (const indicator of groupIndicators) {
    if (lower.includes(indicator)) score += 2;
  }

  return score;
}

/**
 * 自动模式的复杂度评估
 * 根据用户输入和格式判断应该走快速还是高质量模式
 *
 * 设计原则：
 * - 引入需求提取后，大部分复杂输入会被提炼为清晰的结构化描述
 * - 因此自动模式应更倾向于快速模式，只在真正复杂时才使用高质量模式
 * - 高质量模式适用于：大量节点、复杂关系、多层次结构的图表
 * - 评分基于关键词匹配，避免数字提取的误判问题
 */

import type { DiagramFormat } from '@/lib/types/diagram-strategy';
import type { GenerationMode } from './types';

/** 高质量模式的复杂度阈值 */
const QUALITY_THRESHOLD = 6;

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
 * 评分维度（基于关键词匹配，不依赖数字提取）：
 * 1. 规模指标：大型、完整、企业级等描述规模的词
 * 2. 结构复杂度：架构、分层、微服务等描述结构的词
 * 3. 关系密度：依赖、调用、交互等描述关系的词
 * 4. 分组指标：分为、包含、模块等描述分组的词
 * 5. 图表类型：时序图、类图、ER图等复杂图表类型
 */
export function calculateComplexityScore(input: string): number {
  let score = 0;
  const lower = input.toLowerCase();

  // 1. 规模指标：这些词通常意味着图表规模较大
  const scaleIndicators = [
    '大型', '完整', '企业级', '全面', '详细', '复杂',
    'large', 'complete', 'enterprise', 'comprehensive', 'detailed', 'complex',
    '多个', '众多', '大量', '很多',
    'multiple', 'numerous', 'many',
  ];
  for (const indicator of scaleIndicators) {
    if (lower.includes(indicator)) score += 2;
  }

  // 2. 结构复杂度：这些词通常意味着多层次、多模块的复杂架构
  const structureIndicators = [
    '架构', '微服务', '分层', '组件', '模块', '子系统', '层次', '层级',
    'architecture', 'microservice', 'layer', 'component', 'module', 'subsystem',
    '拓扑', 'topology',
    '数据库', '缓存', '消息队列', '负载均衡', '网关',
    'database', 'cache', 'message queue', 'load balancer', 'gateway',
  ];
  for (const indicator of structureIndicators) {
    if (lower.includes(indicator)) score += 1;
  }

  // 3. 关系密度：这些词通常意味着节点之间有复杂的关系
  const relationIndicators = [
    '依赖', '调用', '关联', '交互', '通信', '指向', '流向',
    '依赖关系', '调用关系', '交互关系',
    'depend', 'call', 'interact', 'communicate', 'point to', 'flow to',
    'dependency', 'invocation', 'interaction',
  ];
  for (const indicator of relationIndicators) {
    if (lower.includes(indicator)) score += 1;
  }

  // 4. 分组指标：这些词通常意味着图表有多个分组或模块
  const groupIndicators = [
    '分为', '分成', '包括', '包含', '涵盖',
    'divided into', 'include', 'contain', 'cover',
    'consist of', 'composed of',
    '前端', '后端', '服务层', '数据层', '表示层', '业务层',
    'frontend', 'backend', 'service layer', 'data layer', 'presentation layer', 'business layer',
  ];
  for (const indicator of groupIndicators) {
    if (lower.includes(indicator)) score += 1;
  }

  // 5. 图表类型：这些图表类型通常更复杂
  const complexChartTypes = [
    '时序图', '类图', 'er图', '部署图', '组件图', '包图',
    'sequence diagram', 'class diagram', 'er diagram', 'deployment diagram', 'component diagram', 'package diagram',
    '状态机', '活动图', '状态图',
    'state machine', 'activity diagram', 'state diagram',
  ];
  for (const chartType of complexChartTypes) {
    if (lower.includes(chartType)) score += 2;
  }

  return score;
}

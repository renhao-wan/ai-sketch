/**
 * 生成模式类型定义
 */

/** 生成模式 */
export type GenerationMode = 'fast' | 'auto' | 'quality';

/** 生成步骤类型 */
export type StepType = 'nodes' | 'connections' | 'style';

/** 单个生成步骤 */
export interface GenerationStep {
  type: StepType;
  description: string;
  dependencies: number[];
}

/** Planner 输出的生成计划 */
export interface GenerationPlan {
  complexity: 'simple' | 'medium' | 'complex';
  steps: GenerationStep[];
  estimatedNodes: number;
}

/** Critic 校验结果 */
export interface CritiqueResult {
  passed: boolean;
  issues: string[];
  severity: 'error' | 'warning';
}

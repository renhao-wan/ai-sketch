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

/** 多轮生成的进度事件（通过 SSE 发送给前端） */
export interface ProgressEvent {
  type: 'progress';
  step: number;
  totalSteps: number;
  message: string;
}

/** 自检事件（通过 SSE 发送给前端） */
export interface CritiqueEvent {
  type: 'critique';
  passed: boolean;
  issues: string[];
}

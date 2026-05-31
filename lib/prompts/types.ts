/**
 * 提示词模块类型定义
 */

/** 图表格式 */
export type DiagramFormat = 'excalidraw' | 'mermaid' | 'drawio';

/** AI 操作类型 */
export type AIActionType = 'layout' | 'beautify' | 'simplify' | 'explain';

/** 系统提示词配置 */
export interface SystemPromptConfig {
  /** 任务描述 */
  task: string;
  /** 输入说明 */
  input: string;
  /** 输出约束 */
  output: string;
  /** 格式特定的语法参考 */
  syntaxReference: string;
  /** 最佳实践 */
  bestPractices: string;
}

/** 图表类型规范 */
export interface ChartTypeSpec {
  /** 图表类型名称 */
  type: string;
  /** 设计规范 */
  spec: string;
}

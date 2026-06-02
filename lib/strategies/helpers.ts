/**
 * Shared helpers for diagram strategies.
 * Eliminates duplication across Excalidraw, Mermaid, and Drawio strategies.
 */

import type { DiagramFormat } from '@/lib/types/diagram-strategy';

/**
 * Default exportBlob implementation — identical in all strategies.
 */
export function createExportBlob(code: string, mimeType: string): Blob {
  return new Blob([code], { type: mimeType });
}

/**
 * Identity optimize — used by strategies that have no optimization step.
 */
export function identityOptimize(code: string): string {
  return code;
}

/**
 * Image prompt template shared across all strategies.
 * Each strategy provides its own format name and extra instructions.
 */
export function buildImagePrompt(
  chartType: string,
  formatLabel: string,
  chartTypeNames: Record<string, string>,
  extraInstructions: string,
): string {
  const chartTypeText = chartType && chartType !== 'auto'
    ? `请将图片内容转换为${chartTypeNames[chartType] || chartType}类型的${formatLabel}图表。`
    : `请分析图片内容并选择合适的图表类型转换为${formatLabel}图表。`;

  return `${chartTypeText}

请仔细分析图片中的：
1. 文字内容和标签
2. 图形元素和结构
3. 流程或连接关系
4. 布局和层次关系
5. 数据或数值信息

基于分析结果，创建清晰、准确的${formatLabel}图表，确保：
- 保留图片中的所有关键信息
- 使用合适的图表类型展示内容
- 保持逻辑关系和结构
- 添加必要的文字说明

${extraInstructions}`;
}

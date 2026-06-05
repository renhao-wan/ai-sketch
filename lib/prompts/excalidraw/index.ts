/**
 * Excalidraw 提示词模块
 */

export { EXCALIDRAW_SYSTEM_PROMPT } from './system';
export { EXCALIDRAW_CHART_SPECS, EXCALIDRAW_AUTO_MODE_GUIDE } from './chart-specs';

import { EXCALIDRAW_SYSTEM_PROMPT } from './system';
import { EXCALIDRAW_CHART_SPECS, EXCALIDRAW_AUTO_MODE_GUIDE } from './chart-specs';
import { getChartTypeName } from '@/lib/diagram/constants';

/**
 * 生成 Excalidraw 用户提示词
 * @param userInput 用户输入
 * @param chartType 图表类型，'auto' 表示自动选择
 */
export function buildExcalidrawUserPrompt(userInput: string, chartType: string = 'auto'): string {
  const promptParts: string[] = [];

  if (chartType && chartType !== 'auto') {
    const chartTypeName = getChartTypeName(chartType);
    const visualSpec = EXCALIDRAW_CHART_SPECS[chartType];

    if (chartTypeName) {
      promptParts.push(`请创建一个${chartTypeName}类型的 Excalidraw 图表。`);

      if (visualSpec) {
        promptParts.push(visualSpec.trim());
        promptParts.push(
          `请严格遵循以上视觉规范来设计图表，确保：\n` +
          `- 使用规范中指定的形状类型和颜色\n` +
          `- 遵循规范中的布局要求\n` +
          `- 应用规范中的样式属性（strokeWidth、fontSize等）\n` +
          `- 保持视觉一致性和专业性`
        );
      }
    }
  } else {
    promptParts.push(EXCALIDRAW_AUTO_MODE_GUIDE);
  }

  promptParts.push(`用户需求：\n${userInput}`);
  return promptParts.join('\n\n');
}

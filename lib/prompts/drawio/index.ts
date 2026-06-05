/**
 * Draw.io 提示词模块
 */

export { DRAWIO_SYSTEM_PROMPT } from './system';
export { DRAWIO_GUIDANCE_MAP, DRAWIO_AUTO_MODE_GUIDE } from './chart-specs';

import { DRAWIO_SYSTEM_PROMPT } from './system';
import { DRAWIO_GUIDANCE_MAP, DRAWIO_AUTO_MODE_GUIDE } from './chart-specs';
import { getChartTypeName } from '@/lib/diagram/constants';

/**
 * 生成 Draw.io 用户提示词
 * @param userInput 用户输入
 * @param chartType 图表类型，'auto' 表示自动选择
 */
export function buildDrawioUserPrompt(userInput: string, chartType: string = 'auto'): string {
  const promptParts: string[] = [];

  if (chartType && chartType !== 'auto') {
    const guidance = DRAWIO_GUIDANCE_MAP[chartType];
    const chartName = getChartTypeName(chartType);

    if (guidance) {
      promptParts.push(`请创建一个${chartName || chartType}类型的 Draw.io 图表。`);
      promptParts.push(`### ${chartName || chartType}设计规范\n${guidance}`);
    }
  } else {
    promptParts.push(DRAWIO_AUTO_MODE_GUIDE);
  }

  promptParts.push(`用户需求：\n${userInput}`);
  return promptParts.join('\n\n');
}

/**
 * Mermaid 提示词模块
 */

export { MERMAID_SYSTEM_PROMPT } from './system';
export { MERMAID_CHART_SPECS, MERMAID_TYPE_MAP, MERMAID_AUTO_MODE_GUIDE } from './chart-specs';

import { MERMAID_SYSTEM_PROMPT } from './system';
import { MERMAID_CHART_SPECS, MERMAID_TYPE_MAP, MERMAID_AUTO_MODE_GUIDE } from './chart-specs';
import { getChartTypeName } from '@/lib/diagram/constants';

/**
 * 生成 Mermaid 用户提示词
 * @param userInput 用户输入
 * @param chartType 图表类型，'auto' 表示自动选择
 */
export function buildMermaidUserPrompt(userInput: string, chartType: string = 'auto'): string {
  const promptParts: string[] = [];

  if (chartType && chartType !== 'auto') {
    const mermaidType = MERMAID_TYPE_MAP[chartType];
    const chartName = getChartTypeName(chartType);

    if (mermaidType) {
      promptParts.push(`请创建一个${chartName || chartType}类型的 Mermaid 图表，使用 \`${mermaidType}\` 语法。`);

      const spec = MERMAID_CHART_SPECS[chartType];
      if (spec) {
        promptParts.push(spec.trim());
      }
    }
  } else {
    promptParts.push(MERMAID_AUTO_MODE_GUIDE);
  }

  promptParts.push(`用户需求：\n${userInput}`);
  return promptParts.join('\n\n');
}

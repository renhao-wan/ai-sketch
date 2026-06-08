/**
 * Mermaid 提示词模块
 */

export { MERMAID_SYSTEM_PROMPT } from './system';
export {
  MERMAID_CHART_SPECS,
  MERMAID_TYPE_MAP,
  MERMAID_AUTO_MODE_GUIDE,
  UNSUPPORTED_MERMAID_TYPES,
} from './chart-specs';

import { MERMAID_SYSTEM_PROMPT } from './system';
import {
  MERMAID_CHART_SPECS,
  MERMAID_TYPE_MAP,
  MERMAID_AUTO_MODE_GUIDE,
  UNSUPPORTED_MERMAID_TYPES,
} from './chart-specs';
import { getChartTypeName } from '@/lib/diagram/constants';

/**
 * 检查图表类型是否被 Mermaid 支持
 * @param chartType 图表类型
 * @returns 是否支持
 */
export function isMermaidTypeSupported(chartType: string): boolean {
  return !(UNSUPPORTED_MERMAID_TYPES as readonly string[]).includes(chartType);
}

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

    // 检查是否是不支持的类型
    if (!isMermaidTypeSupported(chartType)) {
      promptParts.push(
        `注意：${chartName || chartType} 不是 Mermaid 原生支持的图表类型。`,
        `请使用最接近的 Mermaid 图表类型（如 flowchart 或 mindmap）来表达用户的需求。`,
      );
    }

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

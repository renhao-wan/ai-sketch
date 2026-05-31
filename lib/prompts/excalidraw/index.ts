/**
 * Excalidraw 提示词模块
 */

export { EXCALIDRAW_SYSTEM_PROMPT } from './system';
export { EXCALIDRAW_CHART_SPECS, EXCALIDRAW_AUTO_MODE_GUIDE } from './chart-specs';

import { EXCALIDRAW_SYSTEM_PROMPT } from './system';
import { EXCALIDRAW_CHART_SPECS, EXCALIDRAW_AUTO_MODE_GUIDE } from './chart-specs';

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

/** 图表类型显示名称映射 */
const CHART_TYPE_NAMES: Record<string, string> = {
  flowchart: '流程图',
  mindmap: '思维导图',
  orgchart: '组织架构图',
  sequence: '时序图',
  class: 'UML类图',
  er: 'ER图',
  gantt: '甘特图',
  timeline: '时间线',
  tree: '树形图',
  network: '网络拓扑图',
  architecture: '架构图',
  dataflow: '数据流图',
  state: '状态图',
  swimlane: '泳道图',
  concept: '概念图',
  fishbone: '鱼骨图',
  swot: 'SWOT分析图',
  pyramid: '金字塔图',
  funnel: '漏斗图',
  venn: '韦恩图',
  matrix: '矩阵图',
  infographic: '信息图',
};

function getChartTypeName(type: string): string {
  return CHART_TYPE_NAMES[type] || type;
}

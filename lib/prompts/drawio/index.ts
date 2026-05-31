/**
 * Draw.io 提示词模块
 */

export { DRAWIO_SYSTEM_PROMPT } from './system';
export { DRAWIO_GUIDANCE_MAP, DRAWIO_AUTO_MODE_GUIDE } from './chart-specs';

import { DRAWIO_SYSTEM_PROMPT } from './system';
import { DRAWIO_GUIDANCE_MAP, DRAWIO_AUTO_MODE_GUIDE } from './chart-specs';

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

// 统一的常量定义

import type { TranslationKey } from '@/lib/locales';

// Chart type options
export const CHART_TYPES = {
  auto: '自动',
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
} as const;

const CHART_TYPE_KEY_MAP: Record<string, TranslationKey> = {
  auto: 'chart.auto',
  flowchart: 'chart.flowchart',
  mindmap: 'chart.mindmap',
  orgchart: 'chart.orgchart',
  sequence: 'chart.sequence',
  class: 'chart.class',
  er: 'chart.er',
  gantt: 'chart.gantt',
  timeline: 'chart.timeline',
  tree: 'chart.tree',
  network: 'chart.network',
  architecture: 'chart.architecture',
  dataflow: 'chart.dataflow',
  state: 'chart.state',
  swimlane: 'chart.swimlane',
  concept: 'chart.concept',
  fishbone: 'chart.fishbone',
  swot: 'chart.swot',
  pyramid: 'chart.pyramid',
  funnel: 'chart.funnel',
  venn: 'chart.venn',
  matrix: 'chart.matrix',
  infographic: 'chart.infographic',
};

export function getChartTypeLabel(key: string, t: (k: TranslationKey) => string): string {
  const translationKey = CHART_TYPE_KEY_MAP[key];
  return translationKey ? t(translationKey) : key;
}

/** Type-safe lookup for CHART_TYPES by key. Returns the key itself as fallback. */
export function getChartTypeName(key: string): string {
  return (CHART_TYPES as Record<string, string>)[key] ?? key;
}

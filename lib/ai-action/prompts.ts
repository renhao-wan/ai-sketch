import type { DiagramFormat } from '@/types/diagram-strategy';

export type AIActionType = 'layout' | 'beautify' | 'simplify' | 'explain';

const ACTION_PROMPTS: Record<AIActionType, string> = {
  layout: '你是图表布局专家。分析用户提供的图表代码，自动调整节点位置和间距，使图表更整齐易读。只返回修改后的完整代码，不要任何解释。',
  beautify: '你是图表美化专家。优化图表的视觉风格，包括颜色搭配、字体大小、对齐方式。只返回修改后的完整代码，不要任何解释。',
  simplify: '你是代码简化专家。精简图表代码结构，去除冗余元素，合并重复定义。只返回修改后的完整代码，不要任何解释。',
  explain: '你是图表分析专家。解释用户提供的图表的含义、逻辑流程、关键节点和潜在问题。使用简洁的中文回答。',
};

export function getActionSystemPrompt(action: AIActionType): string {
  return ACTION_PROMPTS[action];
}

export function getActionUserPrompt(action: AIActionType, code: string, format: DiagramFormat): string {
  if (action === 'explain') {
    return `请解释以下 ${format} 格式的图表：\n\n${code}`;
  }
  return `请对以下 ${format} 格式的图表代码进行${action === 'layout' ? '布局优化' : action === 'beautify' ? '美化处理' : '简化处理'}：\n\n${code}`;
}

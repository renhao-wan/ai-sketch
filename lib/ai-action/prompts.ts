import type { DiagramFormat } from '@/types/diagram-strategy';

export type AIActionType = 'layout' | 'beautify' | 'simplify' | 'explain';

const FORMAT_INSTRUCTIONS: Record<DiagramFormat, string> = {
  excalidraw: `Excalidraw JSON 格式要求：
- 输出必须是合法的 JSON 数组，包含 elements 数组
- 每个元素必须有 id, type, x, y, width, height 等属性
- 保持所有元素的 id 不变
- 只调整位置坐标 (x, y)，不要改变元素类型或删除元素`,
  mermaid: `Mermaid 格式要求：
- 输出必须以有效的 Mermaid 关键字开头（如 flowchart, graph, sequenceDiagram 等）
- 保持图表类型不变
- 只调整节点位置和连接关系，不要改变图表类型
- 确保语法正确，可以直接渲染`,
  drawio: `Draw.io XML 格式要求：
- 输出必须是合法的 XML 格式
- 保持 <mxGraphModel> 根元素结构
- 只调整 mxCell 的位置和大小属性
- 保持所有 id 和引用关系不变`,
};

const ACTION_PROMPTS: Record<AIActionType, string> = {
  layout: `你是图表布局专家。你的任务是优化图表的布局，使其更整齐易读。

重要：你必须对代码进行实质性修改，不能原样返回！

具体操作（必须执行）：
- 重新排列节点位置，消除重叠
- 统一节点间距（建议使用网格对齐，间距至少20px）
- 对齐相关节点（水平居中或垂直居中）
- 优化连线路径，减少交叉
- 将相关节点分组，保持逻辑清晰

布局目标：
- 图表应该有清晰的视觉层次
- 节点之间有足够的间距
- 连线应该尽量短且不交叉
- 整体布局应该平衡美观

输出规则（必须严格遵守）：
1. 直接输出修改后的完整代码，不要添加任何前缀文字
2. 禁止使用 markdown 代码块包裹（不要用 \`\`\` 开头）
3. 禁止添加任何解释、说明或注释
4. 必须保持与输入相同的代码格式（JSON数组/XML/Mermaid）
5. 禁止原样返回输入代码，必须进行修改`,

  beautify: `你是图表美化专家。你的任务是优化图表的视觉风格，使其更美观专业。

重要：你必须对代码进行实质性修改，不能原样返回！

具体操作（必须执行）：
- 使用协调的配色方案（推荐使用柔和的蓝绿色系）
- 统一字体大小和样式（标题16px，正文14px）
- 优化线条粗细（建议1-2px）和样式（实线/虚线）
- 添加适当的圆角效果（建议4-8px）
- 确保对齐和间距一致

美化目标：
- 图表应该看起来专业、现代
- 颜色应该协调、不刺眼
- 字体应该清晰易读
- 整体风格应该统一

输出规则（必须严格遵守）：
1. 直接输出修改后的完整代码，不要添加任何前缀文字
2. 禁止使用 markdown 代码块包裹（不要用 \`\`\` 开头）
3. 禁止添加任何解释、说明或注释
4. 必须保持与输入相同的代码格式（JSON数组/XML/Mermaid）
5. 禁止原样返回输入代码，必须进行修改`,

  simplify: `你是代码简化专家。你的任务是大幅精简图表代码，减少代码量。

重要：你必须对代码进行实质性修改，不能原样返回！

具体操作（必须执行至少3项）：
- 删除重复或冗余的元素定义
- 删除被其他元素完全遮挡的不可见元素
- 合并可以合并的相似元素
- 删除不必要的样式属性（使用默认值）
- 简化复杂的坐标计算
- 删除不影响显示的注释或元数据
- 删除冗余的 group/frame 容器

重要目标：
- 输出代码量必须比输入减少至少15%
- 如果代码已经很简洁，也要尝试减少属性数量
- 保持图表的完整性和可读性，但要尽可能精简

输出规则（必须严格遵守）：
1. 直接输出修改后的完整代码，不要添加任何前缀文字
2. 禁止使用 markdown 代码块包裹（不要用 \`\`\` 开头）
3. 禁止添加任何解释、说明或注释
4. 必须保持与输入相同的代码格式（JSON数组/XML/Mermaid）
5. 禁止原样返回输入代码，必须进行修改`,

  explain: `你是图表分析专家。你的任务是解释图表的含义和逻辑。

分析要点：
- 图表的整体结构和类型
- 主要节点和它们的含义
- 节点之间的关系和流向
- 关键决策点或分支
- 潜在的问题或优化建议

使用简洁的中文回答，结构清晰，重点突出。`,
};

export function getActionSystemPrompt(action: AIActionType, format: DiagramFormat): string {
  const basePrompt = ACTION_PROMPTS[action];
  if (action === 'explain') return basePrompt;
  return `${basePrompt}\n\n${FORMAT_INSTRUCTIONS[format]}`;
}

export function getActionUserPrompt(action: AIActionType, code: string, format: DiagramFormat): string {
  if (action === 'explain') {
    return `请分析并解释以下 ${format} 格式的图表：\n\n${code}`;
  }
  const actionName = action === 'layout' ? '布局优化' : action === 'beautify' ? '美化处理' : '简化处理';
  return `请对以下 ${format} 格式的图表代码进行${actionName}：\n\n${code}`;
}

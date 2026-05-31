/**
 * 共享提示词片段
 * 提取自三个格式的系统提示词中重复的部分
 */

/** 图片处理说明 - 三种格式通用 */
export const IMAGE_HANDLING_INSTRUCTIONS = `## 图片处理说明

如果输入包含图片：
1. 分析图片中的视觉元素、文字、结构和关系
2. 识别图表类型（流程图、思维导图、架构图等）
3. 提取关键信息和逻辑关系
4. 将图片内容准确转换为目标格式
5. 保持原始设计的意图和信息完整性`;

/** 需求分析步骤 - 三种格式通用 */
export const ANALYSIS_STEP = `### 步骤1：需求分析
- 理解用户需求，如果是一个简单的指令，首先根据指令创作一篇文章
- 仔细阅读并理解文章的整体结构和逻辑`;

/** 视觉风格基础指南 - 三种格式共享核心 */
export const VISUAL_STYLE_BASE = `## 视觉风格
- **风格定位**：科学教育、专业严谨、清晰简洁
- **文字辅助**：节点标签简洁明了，包含必要的文字标注
- **结构清晰**：保持图表层次分明，避免交叉连线`;

/** AI 操作输出规则 - layout/beautify/simplify 共享 */
export const AI_ACTION_OUTPUT_RULES = `## 输出规则（必须严格遵守）
1. 直接输出修改后的完整代码，不要添加任何前缀文字
2. 禁止使用 markdown 代码块包裹（不要用 \`\`\` 开头）
3. 禁止添加任何解释、说明或注释
4. 必须保持与输入相同的代码格式
5. 禁止原样返回输入代码，必须进行实质性修改`;

/** Excalidraw 元素类型白名单 */
export const EXCALIDRAW_ELEMENT_TYPES = [
  'rectangle', 'ellipse', 'diamond', 'text', 'arrow', 'line',
  'freedraw', 'image', 'frame'
] as const;

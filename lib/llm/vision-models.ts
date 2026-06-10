/**
 * Vision 模型名匹配列表
 * 用于检测当前配置的 LLM 模型是否支持多模态（图片）输入
 */

const VISION_MODEL_PATTERNS = [
  /^gpt-4o/,           // GPT-4o 系列
  /^gpt-4-turbo/,      // GPT-4 Turbo
  /^claude-3/,         // Claude 3 系列
  /^claude-sonnet-4/,  // Claude Sonnet 4
  /^claude-opus-4/,    // Claude Opus 4
  /^gemini/,           // Gemini 系列
  /^qwen-vl/,          // Qwen-VL
  /^qwen2-vl/,         // Qwen2-VL
  /^internvl/,         // InternVL
  /^llava/,            // LLaVA
  /^moondream/,        // Moondream
  /^deepseek-vl/,      // DeepSeek-VL
];

/**
 * 判断模型是否支持 vision（多模态图片输入）
 * @param modelName 模型名称（大小写不敏感）
 */
export function isVisionModel(modelName: string): boolean {
  const lower = modelName.toLowerCase();
  return VISION_MODEL_PATTERNS.some(pattern => pattern.test(lower));
}

/**
 * 图片处理管线 — 三层降级策略
 *
 * Layer 1: 当前模型支持 vision → 直接返回图片
 * Layer 2: 用户配置了 Vision API → 调用 API 提取描述
 * Layer 3: Tesseract.js OCR → 提取文字
 */

import type { LLMConfig, ImageData } from '@/lib/types';
import { isVisionModel } from './vision-models';
import { getVisionConfig } from '@/lib/db/vision-config';
import { getProvider } from './providers';
import { proxyFetch } from './proxy-manager';

// ── Types ──

export type ImageProcessResult =
  | { mode: 'vision'; images: ImageData[] }
  | { mode: 'text'; description: string };

// ── Layer 1: Vision Model Detection ──

function checkVisionSupport(config: LLMConfig): boolean {
  return isVisionModel(config.model);
}

// ── Layer 2: Vision API ──

/**
 * 调用 Vision API 提取图片描述
 * 使用用户独立配置的 Vision API（openai 兼容或 anthropic）
 */
async function extractViaVisionApi(
  images: ImageData[],
  userPrompt: string,
): Promise<string | null> {
  const visionConfig = await getVisionConfig();
  if (!visionConfig?.baseUrl || !visionConfig?.apiKey || !visionConfig?.model) {
    return null;
  }

  try {
    const provider = getProvider(visionConfig.apiType);
    const url = provider.getEndpoint(visionConfig.baseUrl);
    const headers = provider.buildRequestHeaders(visionConfig.apiKey);

    // 构建带图片的消息
    const message = {
      role: 'user' as const,
      content: userPrompt || '请详细描述这张图片的内容，包括其中的文字、图形、布局和结构关系。',
      images,
    };

    const processedMessage = provider.processMessage(message);
    const body = {
      model: visionConfig.model,
      messages: [processedMessage],
      stream: false,
      max_tokens: 4096,
    };

    const response = await proxyFetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error('[Vision Proxy] Vision API 调用失败:', response.status, await response.text());
      return null;
    }

    const data = await response.json() as Record<string, unknown>;

    // 解析响应（OpenAI 和 Anthropic 格式）
    const choices = data.choices as Array<Record<string, unknown>> | undefined;
    if (choices?.[0]?.message) {
      const content = (choices[0].message as Record<string, unknown>).content;
      if (typeof content === 'string' && content.trim()) {
        return content;
      }
    }

    // Anthropic 格式
    const contentArr = data.content as Array<Record<string, unknown>> | undefined;
    if (contentArr?.[0]?.text) {
      const text = contentArr[0].text;
      if (typeof text === 'string' && text.trim()) {
        return text;
      }
    }

    console.error('[Vision Proxy] Vision API 返回空内容');
    return null;
  } catch (error) {
    console.error('[Vision Proxy] Vision API 调用异常:', error);
    return null;
  }
}

// ── Layer 3: Tesseract.js OCR ──

/**
 * 使用 Tesseract.js 提取图片中的文字
 * 语言包预打包在 assets/tesseract/ 目录
 */
async function extractViaOcr(images: ImageData[]): Promise<string> {
  const Tesseract = (await import('tesseract.js')).default;
  const path = await import('path');

  // 动态获取语言包路径
  let langPath: string;
  try {
    // Electron 生产环境
    const { app } = await import('electron');
    langPath = app.isPackaged
      ? path.join(process.resourcesPath, 'tesseract')
      : path.join(process.cwd(), 'assets', 'tesseract');
  } catch {
    // 非 Electron 环境（开发/测试）
    langPath = path.join(process.cwd(), 'assets', 'tesseract');
  }

  const results = await Promise.all(images.map(async (img) => {
    try {
      const { data: { text } } = await Tesseract.recognize(
        Buffer.from(img.data, 'base64'),
        'eng+chi_sim',
        { langPath },
      );
      return text.trim();
    } catch (error) {
      console.error('[Vision Proxy] OCR 提取失败:', error);
      return '';
    }
  }));

  return results.filter(Boolean).join('\n\n');
}

// ── Pipeline Orchestrator ──

/**
 * 图片处理管线入口
 * 按三层降级策略处理图片，返回图片或文字描述
 *
 * @param config 当前 LLM 配置
 * @param images 用户上传的图片
 * @param userPrompt 用户输入的提示词
 */
export async function processImages(
  config: LLMConfig,
  images: ImageData[],
  userPrompt: string,
): Promise<ImageProcessResult> {
  // Layer 1: 当前模型直接支持 vision
  if (checkVisionSupport(config)) {
    console.log('[Vision Proxy] Layer 1: 当前模型支持 vision，直接发送图片');
    return { mode: 'vision', images };
  }

  console.log('[Vision Proxy] 当前模型不支持 vision，尝试降级处理');

  // Layer 2: 尝试 Vision API
  const visionDescription = await extractViaVisionApi(images, userPrompt);
  if (visionDescription) {
    console.log('[Vision Proxy] Layer 2: Vision API 提取成功');
    return { mode: 'text', description: visionDescription };
  }

  // Layer 3: Tesseract.js OCR
  console.log('[Vision Proxy] Layer 3: 使用 Tesseract.js OCR');
  const ocrText = await extractViaOcr(images);

  if (!ocrText) {
    throw new Error('图片文字提取失败，请确保图片清晰且包含文字内容');
  }

  return { mode: 'text', description: ocrText };
}

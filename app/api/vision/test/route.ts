/**
 * POST /api/vision/test
 * 测试 Vision API 连通性
 * 发送一张 1x1 像素的测试图片验证 API 是否正常工作
 */

import { NextResponse } from 'next/server';
import { getVisionConfig } from '@/lib/db/vision-config';
import { getProvider } from '@/lib/llm/providers';
import { proxyManager } from '@/lib/llm/proxy-manager';
import { fetch as undiciFetch } from 'undici';

/** 1x1 红色像素 PNG 的 base64 */
const TEST_IMAGE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

export async function POST() {
  try {
    const visionConfig = await getVisionConfig();
    if (!visionConfig?.baseUrl || !visionConfig?.apiKey || !visionConfig?.model) {
      return NextResponse.json(
        { success: false, message: 'Vision API 未配置' },
        { status: 400 },
      );
    }

    const provider = getProvider(visionConfig.apiType);
    const url = provider.getEndpoint(visionConfig.baseUrl);
    const headers = provider.buildRequestHeaders(visionConfig.apiKey);

    const message = {
      role: 'user' as const,
      content: 'Describe this image briefly.',
      images: [{ data: TEST_IMAGE_BASE64, mimeType: 'image/png' }],
    };

    const processedMessage = provider.processMessage(message);
    const body = {
      model: visionConfig.model,
      messages: [processedMessage],
      stream: false,
      max_tokens: 100,
    };

    const agent = await proxyManager.getAgent();
    const fetchOptions: RequestInit = {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    };

    const response = agent
      ? (await undiciFetch(url, { ...fetchOptions, dispatcher: agent } as any)) as unknown as Response
      : await fetch(url, fetchOptions);

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({
        success: false,
        message: `API 返回 ${response.status}: ${errorText.substring(0, 200)}`,
      });
    }

    const data = (await response.json()) as Record<string, unknown>;

    // 检查响应格式
    const choices = data.choices as Array<Record<string, unknown>> | undefined;
    const content = data.content as Array<Record<string, unknown>> | undefined;

    if (choices?.[0]?.message || content?.[0]?.text) {
      return NextResponse.json({
        success: true,
        message: `连接成功，模型 ${visionConfig.model} 可正常使用`,
      });
    }

    return NextResponse.json({
      success: false,
      message: 'API 响应格式异常',
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: `连接失败: ${(error as Error).message}`,
    });
  }
}

import { NextResponse } from 'next/server';

const OLLAMA_DEFAULT_URL = 'http://localhost:11434';

interface OllamaTagResponse {
  models?: Array<{
    name: string;
    size?: number;
    digest?: string;
    details?: Record<string, unknown>;
  }>;
}

/**
 * POST /api/ollama/detect
 * 检测本地 Ollama 服务是否运行，并获取可用模型列表
 * 支持传入自定义 baseUrl（如远程 Ollama 服务）
 */
export async function POST(request: Request) {
  try {
    // 支持客户端传入自定义 URL
    const { baseUrl } = await request.json().catch(() => ({}));
    const ollamaUrl = baseUrl || OLLAMA_DEFAULT_URL;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${ollamaUrl}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json({
        detected: false,
        error: `Ollama 服务响应异常: ${response.status}`,
      });
    }

    const data = (await response.json()) as OllamaTagResponse;
    const models = (data.models || []).map(m => ({
      id: m.name,
      name: m.name,
    }));

    return NextResponse.json({
      detected: true,
      models,
    });
  } catch (error) {
    const message = error instanceof DOMException && error.name === 'AbortError'
      ? 'Ollama 服务连接超时'
      : '未检测到 Ollama 服务';
    return NextResponse.json({
      detected: false,
      error: message,
    });
  }
}

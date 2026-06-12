import { NextResponse } from 'next/server';

/** Ollama 默认地址列表（优先 127.0.0.1，回退 localhost） */
const OLLAMA_DEFAULT_URLS = ['http://127.0.0.1:11434', 'http://localhost:11434'];

interface OllamaTagResponse {
  models?: Array<{
    name: string;
    size?: number;
    digest?: string;
    details?: Record<string, unknown>;
  }>;
}

/** 尝试连接单个 Ollama 地址 */
async function tryDetect(baseUrl: string, signal: AbortSignal): Promise<OllamaTagResponse | null> {
  const response = await fetch(`${baseUrl}/api/tags`, { signal });
  if (!response.ok) return null;
  return (await response.json()) as OllamaTagResponse;
}

/**
 * POST /api/ollama/detect
 * 检测本地 Ollama 服务是否运行，并获取可用模型列表
 * 支持传入自定义 baseUrl（如远程 Ollama 服务）
 *
 * 自动尝试 127.0.0.1 和 localhost 两个地址，
 * 解决某些环境下 localhost 解析到 IPv6 (::1) 导致连接失败的问题
 */
export async function POST(request: Request) {
  try {
    const { baseUrl } = await request.json().catch(() => ({}));

    // 如果用户指定了自定义 URL，直接使用
    if (baseUrl) {
      // SSRF 防护：仅允许 localhost 和 127.0.0.1
      try {
        const parsed = new URL(baseUrl);
        if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
          return NextResponse.json({
            detected: false,
            error: '仅支持本地 Ollama 服务（localhost / 127.0.0.1）',
          });
        }
      } catch {
        return NextResponse.json({
          detected: false,
          error: '无效的 URL 格式',
        });
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      try {
        const data = await tryDetect(baseUrl, controller.signal);
        clearTimeout(timeoutId);
        if (data?.models?.length) {
          return NextResponse.json({
            detected: true,
            models: data.models.map(m => ({ id: m.name, name: m.name })),
          });
        }
      } catch {
        clearTimeout(timeoutId);
      }
      return NextResponse.json({ detected: false, error: '未检测到 Ollama 服务' });
    }

    // 自动检测：依次尝试 127.0.0.1 和 localhost
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      for (const url of OLLAMA_DEFAULT_URLS) {
        try {
          const data = await tryDetect(url, controller.signal);
          if (data?.models?.length) {
            clearTimeout(timeoutId);
            return NextResponse.json({
              detected: true,
              models: data.models.map(m => ({ id: m.name, name: m.name })),
            });
          }
        } catch {
          // 当前地址失败，尝试下一个
        }
      }
    } finally {
      clearTimeout(timeoutId);
    }

    return NextResponse.json({ detected: false, error: '未检测到 Ollama 服务' });
  } catch (error) {
    const isAbort = error instanceof DOMException && error.name === 'AbortError';
    const message = isAbort ? 'Ollama 服务连接超时' : '未检测到 Ollama 服务';
    console.error(`[Ollama Detect] ${message}:`, error);
    return NextResponse.json({ detected: false, error: message });
  }
}

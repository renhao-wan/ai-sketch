/**
 * LLM Client for calling OpenAI and Anthropic APIs
 * 使用策略模式支持多种 provider
 */

import type { LLMConfig, LLMMessage, ModelInfo, TestConnectionResult } from '@/lib/types';
import { proxyFetch } from './proxy-manager';
import { getProvider } from './providers';
import { parseSSEStream, parseSSEData } from '@/lib/api/sse-parser';

// ── URL validation ──

/**
 * 校验 baseUrl 格式是否合法
 * 本应用为桌面端（Electron），用户显式配置 LLM 地址，SSRF 风险极低。
 * 此处仅校验 URL 格式和协议，不拦截内网地址（用户可能使用 Ollama 等本地服务）。
 */
function validateBaseUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`无效的 URL: ${url}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('API 地址必须使用 http 或 https 协议');
  }
}

interface SSEProcessorOptions {
  body: ReadableStream<Uint8Array>;
  onChunk?: (chunk: string) => void;
  signal?: AbortSignal;
  extractContent: (json: Record<string, unknown>) => string | undefined;
  checkStop?: (json: Record<string, unknown>) => string | undefined;
  skipLine?: (trimmed: string) => boolean;
}

/**
 * Unified SSE stream processor for both OpenAI and Anthropic
 * 使用共享的 parseSSEStream 解析器
 */
async function processSSEStream(options: SSEProcessorOptions): Promise<string> {
  const { body, onChunk, signal, extractContent, checkStop } = options;
  let fullText = '';

  await parseSSEStream({
    body,
    signal,
    onLine: (data) => {
      const json = parseSSEData(data);

      const truncationMsg = checkStop?.(json);
      if (truncationMsg) {
        throw new Error(truncationMsg);
      }

      const content = extractContent(json);
      if (content) {
        fullText += content;
        if (onChunk) onChunk(content);
      }
    },
  });

  return fullText;
}

/** 判断是否为可重试的网络错误 */
function isRetryableNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    // fetch 抛出的网络错误通常是 TypeError（如 "Failed to fetch"）
    return true;
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    // 用户主动取消，不重试
    return false;
  }
  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code && ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT'].includes(code)) {
      return true;
    }
    // undici 的连接错误消息
    if (error.message.includes('fetch failed') || error.message.includes('Connect Timeout Error')) {
      return true;
    }
  }
  return false;
}

/**
 * Fetch with automatic retry on 429 rate limiting and network errors
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
): Promise<Response> {
  const signal = options.signal;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }

    try {
      const response = await proxyFetch(url, options);

      if (response.status !== 429) {
        return response;
      }

      // 429 Rate Limit — 计算重试延迟
      const retryAfter = response.headers.get('Retry-After');
      let delayMs: number;

      if (retryAfter) {
        const parsed = parseInt(retryAfter, 10);
        delayMs = isNaN(parsed) ? 1000 * (attempt + 1) : parsed * 1000;
      } else {
        delayMs = 1000 * Math.pow(2, attempt);
      }

      await response.text().catch(() => {});
      lastError = new Error(`Rate limited (429). Retrying... (attempt ${attempt + 1}/${maxRetries + 1})`);

      // 等待重试延迟
      if (attempt < maxRetries) {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, delayMs);
          signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          }, { once: true });
        });
      }
    } catch (error) {
      // 网络错误重试
      if (isRetryableNetworkError(error) && attempt < maxRetries) {
        const delayMs = 1000 * Math.pow(2, attempt);
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`[LLM Client] 网络错误，${delayMs}ms 后重试 (attempt ${attempt + 1}/${maxRetries + 1}):`, (error as Error).message);
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, delayMs);
          signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          }, { once: true });
        });
        continue;
      }
      // 不可重试的错误，直接抛出
      throw error;
    }
  }

  throw lastError || new Error('Request failed after all retries');
}

/**
 * Call LLM API with streaming support
 * 使用策略模式，通过 provider 类型分发到对应的实现
 */
export async function callLLM(
  config: LLMConfig,
  messages: LLMMessage[],
  onChunk?: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const { type, baseUrl, apiKey, model, temperature, maxTokens } = config;

  console.log(`[LLM Client] Calling ${type} API, model: ${model}, baseUrl: ${baseUrl}`);

  validateBaseUrl(baseUrl);

  const provider = getProvider(type);
  const url = provider.getEndpoint(baseUrl);
  const headers = provider.buildRequestHeaders(apiKey);
  const body = provider.buildRequestBody(model, messages, temperature, maxTokens);
  const extractors = provider.getSSEExtractors();

  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`${type} API error: ${response.status} ${error}`);
  }

  if (!response.body) {
    throw new Error('响应体为空，流式传输不可用');
  }

  return processSSEStream({
    body: response.body,
    onChunk,
    signal,
    ...extractors,
  });
}

/**
 * Test configuration connection with a simple API call
 */
export async function testConnection(config: LLMConfig): Promise<TestConnectionResult> {
  const { type, baseUrl, apiKey } = config;

  try {
    const models = await fetchModels(type, baseUrl, apiKey);

    if (models && models.length > 0) {
      return {
        success: true,
        message: `连接成功，找到 ${models.length} 个可用模型`,
        models: models.slice(0, 5),
      };
    } else {
      return {
        success: false,
        message: '连接成功但未找到可用模型',
      };
    }
  } catch (error) {
    // 非预期错误记录到控制台以便调试
    if (!(error instanceof TypeError || error instanceof DOMException)) {
      console.error('[LLM Client] testConnection 非预期错误:', error);
    }
    return {
      success: false,
      message: `连接失败: ${(error as Error).message}`,
    };
  }
}

/** 解析模型列表响应（OpenAI 和 Anthropic 格式统一处理） */
function parseModelsResponse(data: unknown): ModelInfo[] {
  const obj = data as Record<string, unknown> | null;
  const raw = Array.isArray(obj?.data) ? obj.data
    : Array.isArray(obj?.models) ? obj.models
    : Array.isArray(data) ? data
    : [];
  return raw
    .map((model: Record<string, unknown> | string) => ({
      id: typeof model === 'string' ? model : (model.id || model.name || model.model || model.slug) as string,
      name: typeof model === 'string' ? model : (model.name || model.id || model.model || model.slug) as string,
    }))
    .filter((m: ModelInfo) => m.id);
}

/**
 * Fetch available models from provider
 * 使用策略模式，通过 provider 类型分发到对应的实现
 * 带 10 秒超时控制，避免无限等待
 */
export async function fetchModels(type: string, baseUrl: string, apiKey: string): Promise<ModelInfo[]> {
  validateBaseUrl(baseUrl);

  const provider = getProvider(type);
  const url = provider.getModelsEndpoint(baseUrl);
  const headers = provider.buildModelsRequestHeaders(apiKey);

  // 10 秒超时控制
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await proxyFetch(url, { headers, signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }

    return parseModelsResponse(await response.json());
  } finally {
    clearTimeout(timeoutId);
  }
}

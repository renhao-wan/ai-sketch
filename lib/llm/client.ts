/**
 * LLM Client for calling OpenAI and Anthropic APIs
 * 使用策略模式支持多种 provider
 */

import type { LLMConfig, LLMMessage, ModelInfo, TestConnectionResult } from '@/lib/types';
import { fetch as undiciFetch } from 'undici';
import { proxyManager } from './proxy-manager';
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

/**
 * 代理感知的 fetch 封装
 * 有代理时用 undici.fetch + ProxyAgent，无代理时用全局 fetch
 * 注意: undici.fetch 的 dispatcher 参数未被标准 RequestInit 类型覆盖，
 * 因此需要类型断言；返回值类型与全局 fetch 兼容但签名不同，需双重断言。
 */
async function proxyFetch(url: string, options?: RequestInit): Promise<Response> {
  const agent = await proxyManager.getAgent();
  if (agent) {
    return undiciFetch(url, { ...options, dispatcher: agent } as any) as unknown as Promise<Response>;
  }
  return fetch(url, options);
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
  const { body, onChunk, signal, extractContent, checkStop, skipLine } = options;
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

/**
 * Fetch with automatic retry on 429 rate limiting
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

    console.time(`[LLM Client] API Request (attempt ${attempt + 1})`);
    const response = await proxyFetch(url, options);
    console.timeEnd(`[LLM Client] API Request (attempt ${attempt + 1})`);

    if (response.status !== 429) {
      return response;
    }

    const retryAfter = response.headers.get('Retry-After');
    let delayMs: number;

    if (retryAfter) {
      const parsed = parseInt(retryAfter, 10);
      delayMs = isNaN(parsed) ? 1000 * (attempt + 1) : parsed * 1000;
    } else {
      delayMs = 1000 * Math.pow(2, attempt);
    }

    await response.text().catch(() => {});

    if (attempt < maxRetries) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, delayMs);
        signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        }, { once: true });
      });
    }

    lastError = new Error(`Rate limited (429). Retrying... (attempt ${attempt + 1}/${maxRetries + 1})`);
  }

  throw lastError || new Error('Rate limited after all retries');
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
  const { type, baseUrl, apiKey, model, temperature } = config;

  console.log(`[LLM Client] Calling ${type} API, model: ${model}, baseUrl: ${baseUrl}, temperature: ${temperature ?? 0.5}`);

  validateBaseUrl(baseUrl);

  const provider = getProvider(type);
  const url = provider.getEndpoint(baseUrl);
  const headers = provider.buildRequestHeaders(apiKey);
  const body = provider.buildRequestBody(model, messages, temperature);
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
    throw new Error('Response body is null — stream not available');
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
 */
export async function fetchModels(type: string, baseUrl: string, apiKey: string): Promise<ModelInfo[]> {
  validateBaseUrl(baseUrl);

  const provider = getProvider(type);
  const url = provider.getModelsEndpoint(baseUrl);
  const headers = provider.buildModelsRequestHeaders(apiKey);

  const response = await proxyFetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.status}`);
  }

  return parseModelsResponse(await response.json());
}

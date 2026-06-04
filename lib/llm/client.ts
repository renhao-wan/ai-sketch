/**
 * LLM Client for calling OpenAI and Anthropic APIs
 */

import type { LLMConfig, LLMMessage, ModelInfo, TestConnectionResult } from '@/lib/types';
import { ProxyAgent, fetch as undiciFetch } from 'undici';

// ── SSRF protection ──

/** 禁止的内网地址前缀 */
const BLOCKED_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '0:0:0:0:0:0:0:1']);
const BLOCKED_PREFIXES = ['10.', '192.168.', '172.16.', '172.17.', '172.18.', '172.19.',
  '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.',
  '172.28.', '172.29.', '172.30.', '172.31.', '169.254.'];

/**
 * 校验 baseUrl 是否安全（防止 SSRF）
 * 禁止指向内网地址的请求
 */
function validateBaseUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`无效的 URL: ${url}`);
  }
  const hostname = parsed.hostname;
  if (BLOCKED_HOSTNAMES.has(hostname) || BLOCKED_PREFIXES.some(p => hostname.startsWith(p))) {
    throw new Error('不允许使用内网地址作为 API 地址');
  }
}

// ── Proxy support ──
// 优先从 DB 读取代理配置（用户在设置中配置），回退到环境变量
let cachedAgent: ProxyAgent | undefined;
let cachedProxyUrl: string | null = null;
let lastCheck = 0;
let hasChecked = false; // 标记是否已查询过代理配置（含"无代理"状态）
const CACHE_TTL = 5000; // 5 秒缓存

/** 获取代理 Agent（带缓存，动态读取 DB 配置） */
async function getProxyAgent(): Promise<ProxyAgent | undefined> {
  const now = Date.now();
  if (now - lastCheck < CACHE_TTL && hasChecked) {
    return cachedAgent;
  }
  lastCheck = now;
  hasChecked = true;

  try {
    console.time('[LLM Client] Load Proxy Config');
    const { configManager } = await import('@/lib/db/config-manager');
    const { proxyUrl, proxyEnabled } = await configManager.getProxy();
    console.timeEnd('[LLM Client] Load Proxy Config');

    if (proxyEnabled && proxyUrl) {
      if (proxyUrl !== cachedProxyUrl) {
        // 关闭旧的代理实例，避免连接泄漏
        if (cachedAgent) {
          try { await cachedAgent.close(); } catch { /* ignore */ }
        }
        cachedProxyUrl = proxyUrl;
        cachedAgent = new ProxyAgent(proxyUrl);
      }
      return cachedAgent;
    }
  } catch {
    // DB 不可用时回退到环境变量
  }

  // 回退：环境变量
  const envProxy = process.env.HTTPS_PROXY || process.env.https_proxy
    || process.env.HTTP_PROXY || process.env.http_proxy;
  if (envProxy) {
    if (envProxy !== cachedProxyUrl) {
      // 关闭旧的代理实例，避免连接泄漏
      if (cachedAgent) {
        try { await cachedAgent.close(); } catch { /* ignore */ }
      }
      cachedProxyUrl = envProxy;
      cachedAgent = new ProxyAgent(envProxy);
    }
    return cachedAgent;
  }

  // 无代理时，清除旧的 agent
  if (cachedAgent) {
    try { await cachedAgent.close(); } catch { /* ignore */ }
    cachedAgent = undefined;
    cachedProxyUrl = null;
  }

  return undefined;
}

/**
 * 代理感知的 fetch 封装
 * 有代理时用 undici.fetch + ProxyAgent，无代理时用全局 fetch
 * 注意: undici.fetch 的 dispatcher 参数未被标准 RequestInit 类型覆盖，
 * 因此需要类型断言；返回值类型与全局 fetch 兼容但签名不同，需双重断言。
 */
async function proxyFetch(url: string, options?: RequestInit): Promise<Response> {
  const agent = await getProxyAgent();
  if (agent) {
    return undiciFetch(url, { ...options, dispatcher: agent } as any) as unknown as Promise<Response>;
  }
  return fetch(url, options);
}

interface OpenAIMessage {
  role: string;
  content: string | Array<{ type: string; text?: string; image_url?: { url: string; detail: string } }>;
}

interface AnthropicMessage {
  role: string;
  content: Array<{ type: string; text?: string; source?: { type: string; media_type: string; data: string } }>;
}

const MAX_PARSE_ERRORS = 10;

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
 */
async function processSSEStream(options: SSEProcessorOptions): Promise<string> {
  const { body, onChunk, signal, extractContent, checkStop, skipLine } = options;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';
  let consecutiveParseErrors = 0;

  try {
    while (true) {
      if (signal?.aborted) {
        reader.releaseLock();
        throw new DOMException('The operation was aborted.', 'AbortError');
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (skipLine?.(trimmed)) continue;

        if (trimmed.startsWith('data: ')) {
          try {
            const json = JSON.parse(trimmed.slice(6)) as Record<string, unknown>;
            consecutiveParseErrors = 0;

            const truncationMsg = checkStop?.(json);
            if (truncationMsg) {
              throw new Error(truncationMsg);
            }

            const content = extractContent(json);
            if (content) {
              fullText += content;
              if (onChunk) onChunk(content);
            }
          } catch (e) {
            if (e instanceof SyntaxError) {
              consecutiveParseErrors++;
              if (consecutiveParseErrors >= MAX_PARSE_ERRORS) {
                throw new Error('Too many consecutive SSE parse failures — stream may be corrupted');
              }
            } else {
              throw e;
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

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
 */
export async function callLLM(
  config: LLMConfig,
  messages: LLMMessage[],
  onChunk?: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const { type, baseUrl, apiKey, model } = config;

  console.log(`[LLM Client] Calling ${type} API, model: ${model}, baseUrl: ${baseUrl}`);

  if (type === 'openai') {
    return callOpenAI(baseUrl, apiKey, model, messages, onChunk, signal);
  } else if (type === 'anthropic') {
    return callAnthropic(baseUrl, apiKey, model, messages, onChunk, signal);
  } else {
    throw new Error(`Unsupported provider type: ${type}`);
  }
}

/**
 * Call OpenAI-compatible API
 */
async function callOpenAI(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: LLMMessage[],
  onChunk?: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  validateBaseUrl(baseUrl);
  const url = `${baseUrl}/chat/completions`;

  const processedMessages = messages.map(processMessageForOpenAI);

  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: processedMessages,
      stream: true,
      max_tokens: 16384,
    }),
    signal,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${error}`);
  }

  if (!response.body) {
    throw new Error('Response body is null — stream not available');
  }

  return processSSEStream({
    body: response.body,
    onChunk,
    signal,
    extractContent: (json) => {
      const choices = json.choices as Array<Record<string, unknown>> | undefined;
      const delta = choices?.[0]?.delta as Record<string, unknown> | undefined;
      return delta?.content as string | undefined;
    },
    checkStop: (json) => {
      const choices = json.choices as Array<Record<string, unknown>> | undefined;
      const finishReason = choices?.[0]?.finish_reason;
      if (finishReason === 'length') {
        return 'TRUNCATED: Output was truncated due to max_tokens limit';
      }
      return undefined;
    },
    skipLine: (trimmed) => trimmed === 'data: [DONE]',
  });
}

/**
 * Call Anthropic API
 */
async function callAnthropic(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: LLMMessage[],
  onChunk?: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  validateBaseUrl(baseUrl);
  const url = `${baseUrl}/messages`;

  const systemMessage = messages.find(m => m.role === 'system');
  const chatMessages = messages.filter(m => m.role !== 'system');
  const processedMessages = chatMessages.map(processMessageForAnthropic);

  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      messages: processedMessages,
      system: systemMessage ? [{ type: 'text', text: systemMessage.content }] : undefined,
      max_tokens: 64000,
      stream: true,
      temperature: 1,
    }),
    signal,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${error}`);
  }

  if (!response.body) {
    throw new Error('Response body is null — stream not available');
  }

  return processSSEStream({
    body: response.body,
    onChunk,
    signal,
    extractContent: (json) => {
      if (json.type === 'content_block_delta') {
        const delta = json.delta as Record<string, unknown> | undefined;
        return delta?.text as string | undefined;
      }
      return undefined;
    },
    checkStop: (json) => {
      if (json.type === 'message_delta') {
        const delta = json.delta as Record<string, unknown> | undefined;
        if (delta?.stop_reason === 'max_tokens') {
          return 'TRUNCATED: Output was truncated due to max_tokens limit';
        }
      }
      return undefined;
    },
  });
}

/**
 * Process message for OpenAI API with multimodal support
 */
function processMessageForOpenAI(message: LLMMessage): OpenAIMessage {
  const images = message.images;
  if (!images || images.length === 0) {
    return message;
  }

  const contentParts: Array<{ type: string; text?: string; image_url?: { url: string; detail: string } }> = [
    { type: 'text', text: message.content },
  ];

  for (const img of images) {
    contentParts.push({
      type: 'image_url',
      image_url: {
        url: `data:${img.mimeType};base64,${img.data}`,
        detail: 'high',
      },
    });
  }

  return {
    role: message.role,
    content: contentParts,
  };
}

/**
 * Process message for Anthropic API with multimodal support
 */
function processMessageForAnthropic(message: LLMMessage): AnthropicMessage {
  const images = message.images;
  if (!images || images.length === 0) {
    return message as unknown as AnthropicMessage;
  }

  const contentParts: Array<{ type: string; text?: string; source?: { type: string; media_type: string; data: string } }> = [
    { type: 'text', text: message.content },
  ];

  for (const img of images) {
    contentParts.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: img.mimeType,
        data: img.data,
      },
    });
  }

  return {
    role: message.role === 'assistant' ? 'assistant' : 'user',
    content: contentParts,
  };
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
 */
export async function fetchModels(type: string, baseUrl: string, apiKey: string): Promise<ModelInfo[]> {
  validateBaseUrl(baseUrl);

  if (type === 'openai') {
    const url = `${baseUrl}/models`;
    const response = await proxyFetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }

    return parseModelsResponse(await response.json());
  } else if (type === 'anthropic') {
    const url = `${baseUrl}/models`;
    const response = await proxyFetch(url, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }

    return parseModelsResponse(await response.json());
  } else {
    throw new Error(`Unsupported provider type: ${type}`);
  }
}

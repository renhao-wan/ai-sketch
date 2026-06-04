/**
 * SSE 流式解析工具函数
 * 从 /api/generate 的 SSE 响应中提取内容
 */

/** SSE 事件回调 */
export interface SSECallbacks {
  /** 收到 meta 事件（包含 conversationId） */
  onMeta?: (conversationId: string) => void;
  /** 收到内容 chunk（已去除代码围栏） */
  onContent: (stripped: string, raw: string) => void;
  /** 收到错误事件 */
  onError?: (error: string) => void;
}

/** SSE 消费结果 */
export interface SSEResult {
  accumulatedCode: string;
}

/**
 * 消费 SSE 流，解析事件并调用回调
 * 处理 data: [DONE]、data: {"type":"content",...} 等格式
 */
export async function consumeSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal: AbortSignal,
  callbacks: SSECallbacks,
): Promise<SSEResult> {
  const decoder = new TextDecoder();
  let accumulatedCode = '';
  let buffer = '';

  try {
    while (true) {
      if (signal.aborted) {
        break;
      }

      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() === '' || line.trim() === 'data: [DONE]') continue;
        if (!line.startsWith('data: ')) continue;

        try {
          const data = JSON.parse(line.slice(6));

          if (data.type === 'meta' && data.conversationId) {
            callbacks.onMeta?.(data.conversationId);
          } else if (data.type === 'content' && data.content) {
            accumulatedCode += data.content;
            callbacks.onContent(accumulatedCode, data.content);
          } else if (data.type === 'error') {
            throw new Error(data.error);
          } else if (data.content) {
            // Backward compatibility: old format without type field
            accumulatedCode += data.content;
            callbacks.onContent(accumulatedCode, data.content);
          }
        } catch (e) {
          if (e instanceof SyntaxError) {
            console.warn('[SSE] JSON parse error:', e.message, 'Raw:', line);
          } else {
            throw e;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return { accumulatedCode };
}

/**
 * 解析 API 错误响应，返回友好的错误消息
 */
export async function parseAPIError(response: Response, fallback: string): Promise<string> {
  try {
    const errorData = await response.json();
    if (errorData.error) return errorData.error;
  } catch {
    // ignore
  }
  switch (response.status) {
    case 400: return '请求参数错误';
    case 401: case 403: return 'API Key 无效或权限不足';
    case 429: return '请求过于频繁，请稍后重试';
    case 500: case 502: case 503: return '服务器错误，请稍后重试';
    default: return `${fallback} (${response.status})`;
  }
}

/**
 * SSE 流解析器
 * 提供底层的 SSE 解析逻辑，支持不同的上层处理器
 */

/** SSE 解析器选项 */
export interface SSEParserOptions {
  /** 输入流 */
  body: ReadableStream<Uint8Array>;
  /** 中断信号 */
  signal?: AbortSignal;
  /** 处理每一行的回调 */
  onLine: (line: string) => void;
  /** 最大连续解析错误次数 */
  maxParseErrors?: number;
}

/**
 * 底层 SSE 解析器
 * 负责读取流、分割行、跳过空行和 [DONE] 标记
 */
export async function parseSSEStream(options: SSEParserOptions): Promise<void> {
  const { body, signal, onLine, maxParseErrors = 10 } = options;
  const reader = body.getReader();
  const decoder = new TextDecoder();
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
        if (trimmed === 'data: [DONE]') continue;

        if (trimmed.startsWith('data: ')) {
          try {
            onLine(trimmed.slice(6));
            consecutiveParseErrors = 0;
          } catch (e) {
            if (e instanceof SyntaxError) {
              consecutiveParseErrors++;
              if (consecutiveParseErrors >= maxParseErrors) {
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
}

/**
 * 从 SSE 数据行中解析 JSON
 * @param data JSON 字符串
 * @returns 解析后的对象
 */
export function parseSSEData(data: string): Record<string, unknown> {
  return JSON.parse(data) as Record<string, unknown>;
}

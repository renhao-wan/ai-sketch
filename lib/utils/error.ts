/**
 * 错误处理工具函数
 */

/** 判断是否为可重试的错误（用于 LLM 调用重试逻辑） */
export function isRetryableError(error: unknown): boolean {
  // 用户主动取消，不重试
  if (error instanceof DOMException && error.name === 'AbortError') {
    return false;
  }

  // 网络错误通常可重试
  if (error instanceof TypeError) {
    return true;
  }

  if (error instanceof Error) {
    // 检查 Node.js 网络错误码
    const code = (error as NodeJS.ErrnoException).code;
    if (code && [
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'EAI_AGAIN',
      'UND_ERR_CONNECT_TIMEOUT',
    ].includes(code)) {
      return true;
    }

    // undici 的连接错误消息
    if (
      error.message.includes('fetch failed') ||
      error.message.includes('Connect Timeout Error')
    ) {
      return true;
    }

    // 429 Rate Limit 错误可重试
    if (error.message.includes('429') || error.message.includes('Rate limited')) {
      return true;
    }
  }

  return false;
}

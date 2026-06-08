/**
 * Ollama Provider 实现
 * 支持本地 Ollama 模型运行时
 * Ollama 使用 OpenAI 兼容的 API，但模型列表使用独立的 /api/tags 端点，且不需要 API Key
 */

import type { LLMProvider } from './types';
import { OpenAIProvider } from './openai';

export class OllamaProvider extends OpenAIProvider implements LLMProvider {
  readonly type = 'ollama';

  /**
   * 构建请求头
   * Ollama 不需要 API Key，但如果有提供则仍然发送
   */
  buildRequestHeaders(apiKey: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // 仅在 apiKey 非空时添加 Authorization
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    return headers;
  }

  /**
   * 获取 API 端点路径
   * Ollama 的 OpenAI 兼容端点带 /v1 前缀
   */
  getEndpoint(baseUrl: string): string {
    return `${baseUrl}/v1/chat/completions`;
  }

  /**
   * 获取模型列表的请求头
   * Ollama 不需要 Authorization
   */
  buildModelsRequestHeaders(_apiKey: string): Record<string, string> {
    return {};
  }

  /**
   * 获取模型列表的端点
   * Ollama 使用独立的 /api/tags 端点
   */
  getModelsEndpoint(baseUrl: string): string {
    return `${baseUrl}/api/tags`;
  }
}

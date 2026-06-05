/**
 * OpenAI Provider 实现
 * 支持 OpenAI 和 OpenAI 兼容的 API（如 Ollama、vLLM 等）
 */

import type { LLMMessage } from '@/lib/types';
import type { LLMProvider, SSEExtractors } from './types';

interface OpenAIMessage {
  role: string;
  content: string | Array<{ type: string; text?: string; image_url?: { url: string; detail: string } }>;
}

export class OpenAIProvider implements LLMProvider {
  readonly type = 'openai';

  buildRequestHeaders(apiKey: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };
  }

  buildRequestBody(model: string, messages: LLMMessage[]): object {
    return {
      model,
      messages: messages.map(m => this.processMessage(m)),
      stream: true,
      max_tokens: 16384,
    };
  }

  getEndpoint(baseUrl: string): string {
    return `${baseUrl}/chat/completions`;
  }

  getSSEExtractors(): SSEExtractors {
    return {
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
    };
  }

  processMessage(message: LLMMessage): OpenAIMessage {
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

  buildModelsRequestHeaders(apiKey: string): Record<string, string> {
    return {
      'Authorization': `Bearer ${apiKey}`,
    };
  }

  getModelsEndpoint(baseUrl: string): string {
    return `${baseUrl}/models`;
  }
}

/**
 * Anthropic Provider 实现
 * 支持 Claude 系列模型
 */

import type { LLMMessage } from '@/lib/types';
import type { LLMProvider, SSEExtractors } from './types';

interface AnthropicMessage {
  role: string;
  content: Array<{ type: string; text?: string; source?: { type: string; media_type: string; data: string } }>;
}

export class AnthropicProvider implements LLMProvider {
  readonly type = 'anthropic';

  buildRequestHeaders(apiKey: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    };
  }

  buildRequestBody(model: string, messages: LLMMessage[], temperature?: number, maxTokens?: number): object {
    const systemMessage = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    return {
      model,
      messages: chatMessages.map(m => this.processMessage(m)),
      system: systemMessage ? [{ type: 'text', text: systemMessage.content }] : undefined,
      max_tokens: maxTokens ?? 16384,
      stream: true,
      temperature: temperature ?? 0.5,
    };
  }

  getEndpoint(baseUrl: string): string {
    return `${baseUrl}/messages`;
  }

  getSSEExtractors(): SSEExtractors {
    return {
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
    };
  }

  processMessage(message: LLMMessage): AnthropicMessage {
    const images = message.images;
    if (!images || images.length === 0) {
      // 无图片时显式构造 AnthropicMessage，避免不安全的类型断言
      return {
        role: message.role,
        content: [{ type: 'text', text: message.content }],
      };
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

  buildModelsRequestHeaders(apiKey: string): Record<string, string> {
    return {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    };
  }

  getModelsEndpoint(baseUrl: string): string {
    return `${baseUrl}/models`;
  }
}

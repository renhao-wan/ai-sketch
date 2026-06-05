import { describe, it, expect } from 'vitest';
import { OpenAIProvider } from './openai';

const provider = new OpenAIProvider();

describe('OpenAIProvider', () => {
  describe('buildRequestHeaders', () => {
    it('应包含 Authorization 和 Content-Type', () => {
      const headers = provider.buildRequestHeaders('sk-test');
      expect(headers['Authorization']).toBe('Bearer sk-test');
      expect(headers['Content-Type']).toBe('application/json');
    });
  });

  describe('buildRequestBody', () => {
    it('应构建正确的请求体', () => {
      const messages = [{ role: 'user' as const, content: 'hello' }];
      const body = provider.buildRequestBody('gpt-4', messages, 0.3) as Record<string, unknown>;
      expect(body.model).toBe('gpt-4');
      expect(body.stream).toBe(true);
      expect(body.temperature).toBe(0.3);
      expect(body.max_tokens).toBe(16384);
    });

    it('应使用默认 temperature 0.5', () => {
      const body = provider.buildRequestBody('gpt-4', []) as Record<string, unknown>;
      expect(body.temperature).toBe(0.5);
    });

    it('应使用自定义 maxTokens', () => {
      const body = provider.buildRequestBody('gpt-4', [], 0.5, 8192) as Record<string, unknown>;
      expect(body.max_tokens).toBe(8192);
    });

    it('未传 maxTokens 时应使用默认值 16384', () => {
      const body = provider.buildRequestBody('gpt-4', []) as Record<string, unknown>;
      expect(body.max_tokens).toBe(16384);
    });
  });

  describe('getEndpoint', () => {
    it('应拼接 /chat/completions', () => {
      expect(provider.getEndpoint('https://api.openai.com/v1')).toBe('https://api.openai.com/v1/chat/completions');
    });
  });

  describe('getSSEExtractors', () => {
    it('应从 delta 中提取 content', () => {
      const { extractContent } = provider.getSSEExtractors();
      expect(extractContent({ choices: [{ delta: { content: 'hello' } }] })).toBe('hello');
    });

    it('无 choices 时返回 undefined', () => {
      const { extractContent } = provider.getSSEExtractors();
      expect(extractContent({})).toBeUndefined();
    });

    it('应检测 length 截断', () => {
      const { checkStop } = provider.getSSEExtractors();
      expect(checkStop!({ choices: [{ finish_reason: 'length' }] })).toContain('TRUNCATED');
    });

    it('应跳过 [DONE]', () => {
      const { skipLine } = provider.getSSEExtractors();
      expect(skipLine!('data: [DONE]')).toBe(true);
      expect(skipLine!('data: {"choices":[]}')).toBe(false);
    });
  });

  describe('processMessage', () => {
    it('无图片时原样返回', () => {
      const msg = { role: 'user' as const, content: 'hello' };
      expect(provider.processMessage(msg)).toEqual(msg);
    });

    it('有图片时转换为 content 数组', () => {
      const msg = {
        role: 'user' as const,
        content: 'describe this',
        images: [{ data: 'base64data', mimeType: 'image/png' }],
      };
      const result = provider.processMessage(msg) as Record<string, unknown>;
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content).toHaveLength(2);
      expect(result.content[1].type).toBe('image_url');
      expect(result.content[1].image_url.url).toContain('data:image/png;base64,');
    });
  });

  describe('getModelsEndpoint', () => {
    it('应拼接 /models', () => {
      expect(provider.getModelsEndpoint('https://api.openai.com/v1')).toBe('https://api.openai.com/v1/models');
    });
  });
});

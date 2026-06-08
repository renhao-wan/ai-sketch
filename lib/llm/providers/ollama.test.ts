import { describe, it, expect } from 'vitest';
import { OllamaProvider } from './ollama';

const provider = new OllamaProvider();

describe('OllamaProvider', () => {
  describe('type', () => {
    it('type 应为 ollama', () => {
      expect(provider.type).toBe('ollama');
    });
  });

  describe('buildRequestHeaders', () => {
    it('无 apiKey 时不发送 Authorization', () => {
      const headers = provider.buildRequestHeaders('');
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['Authorization']).toBeUndefined();
    });

    it('有 apiKey 时发送 Authorization', () => {
      const headers = provider.buildRequestHeaders('sk-test');
      expect(headers['Authorization']).toBe('Bearer sk-test');
      expect(headers['Content-Type']).toBe('application/json');
    });
  });

  describe('getEndpoint', () => {
    it('应拼接 /v1/chat/completions', () => {
      expect(provider.getEndpoint('http://localhost:11434')).toBe('http://localhost:11434/v1/chat/completions');
    });
  });

  describe('getModelsEndpoint', () => {
    it('应拼接 /api/tags', () => {
      expect(provider.getModelsEndpoint('http://localhost:11434')).toBe('http://localhost:11434/api/tags');
    });
  });

  describe('buildModelsRequestHeaders', () => {
    it('不需要 Authorization', () => {
      const headers = provider.buildModelsRequestHeaders('any-key');
      expect(headers['Authorization']).toBeUndefined();
    });

    it('应返回空对象', () => {
      const headers = provider.buildModelsRequestHeaders('');
      expect(Object.keys(headers)).toHaveLength(0);
    });
  });

  describe('buildRequestBody', () => {
    it('应构建正确的请求体', () => {
      const messages = [{ role: 'user' as const, content: 'hello' }];
      const body = provider.buildRequestBody('llama3', messages, 0.3) as Record<string, unknown>;
      expect(body.model).toBe('llama3');
      expect(body.stream).toBe(true);
      expect(body.temperature).toBe(0.3);
      expect(body.max_tokens).toBe(16384);
    });

    it('应使用默认 temperature 0.5', () => {
      const body = provider.buildRequestBody('llama3', []) as Record<string, unknown>;
      expect(body.temperature).toBe(0.5);
    });

    it('应使用自定义 maxTokens', () => {
      const body = provider.buildRequestBody('llama3', [], 0.5, 8192) as Record<string, unknown>;
      expect(body.max_tokens).toBe(8192);
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

    it('非 length 截断时返回 undefined', () => {
      const { checkStop } = provider.getSSEExtractors();
      expect(checkStop!({ choices: [{ finish_reason: 'stop' }] })).toBeUndefined();
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
      const result = provider.processMessage(msg) as unknown as Record<string, unknown>;
      const content = result.content as unknown[];
      expect(Array.isArray(content)).toBe(true);
      expect(content).toHaveLength(2);
      expect((content[1] as Record<string, unknown>).type).toBe('image_url');
    });
  });
});

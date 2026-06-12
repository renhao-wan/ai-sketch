import { describe, it, expect } from 'vitest';
import { AnthropicProvider } from './anthropic';

const provider = new AnthropicProvider();

describe('AnthropicProvider', () => {
  describe('buildRequestHeaders', () => {
    it('应包含 x-api-key 和 anthropic-version', () => {
      const headers = provider.buildRequestHeaders('sk-ant-test');
      expect(headers['x-api-key']).toBe('sk-ant-test');
      expect(headers['anthropic-version']).toBe('2023-06-01');
      expect(headers['Content-Type']).toBe('application/json');
    });
  });

  describe('buildRequestBody', () => {
    it('应提取 system 消息并转换', () => {
      const messages = [
        { role: 'system' as const, content: 'you are helpful' },
        { role: 'user' as const, content: 'hello' },
      ];
      const body = provider.buildRequestBody('claude-3', messages, 0.4) as Record<string, unknown>;
      expect(body.model).toBe('claude-3');
      expect(body.stream).toBe(true);
      expect(body.temperature).toBe(0.4);
      expect(body.max_tokens).toBe(16384);
      // system 应从 messages 中分离
      expect(body.messages).toHaveLength(1);
      expect(body.system).toEqual([{ type: 'text', text: 'you are helpful' }]);
    });

    it('无 system 消息时 system 为 undefined', () => {
      const body = provider.buildRequestBody('claude-3', [{ role: 'user' as const, content: 'hi' }]) as Record<string, unknown>;
      expect(body.system).toBeUndefined();
    });

    it('应使用自定义 maxTokens', () => {
      const body = provider.buildRequestBody('claude-3', [{ role: 'user' as const, content: 'hi' }], 0.5, 32000) as Record<string, unknown>;
      expect(body.max_tokens).toBe(32000);
    });

    it('未传 maxTokens 时应使用默认值 16384', () => {
      const body = provider.buildRequestBody('claude-3', [{ role: 'user' as const, content: 'hi' }]) as Record<string, unknown>;
      expect(body.max_tokens).toBe(16384);
    });
  });

  describe('getEndpoint', () => {
    it('应拼接 /messages', () => {
      expect(provider.getEndpoint('https://api.anthropic.com/v1')).toBe('https://api.anthropic.com/v1/messages');
    });
  });

  describe('getSSEExtractors', () => {
    it('应从 content_block_delta 提取 text', () => {
      const { extractContent } = provider.getSSEExtractors();
      expect(extractContent({ type: 'content_block_delta', delta: { text: 'hello' } })).toBe('hello');
    });

    it('非 content_block_delta 返回 undefined', () => {
      const { extractContent } = provider.getSSEExtractors();
      expect(extractContent({ type: 'message_start' })).toBeUndefined();
    });

    it('应检测 max_tokens 截断', () => {
      const { checkStop } = provider.getSSEExtractors();
      expect(checkStop!({ type: 'message_delta', delta: { stop_reason: 'max_tokens' } })).toContain('TRUNCATED');
    });

    it('非截断返回 undefined', () => {
      const { checkStop } = provider.getSSEExtractors();
      expect(checkStop!({ type: 'message_delta', delta: { stop_reason: 'end_turn' } })).toBeUndefined();
    });
  });

  describe('processMessage', () => {
    it('无图片时转换为 content 数组格式', () => {
      const msg = { role: 'user' as const, content: 'hello' };
      const result = provider.processMessage(msg);
      expect(result.role).toBe('user');
      expect(result.content).toEqual([{ type: 'text', text: 'hello' }]);
    });

    it('有图片时转换为 content 数组', () => {
      const msg = {
        role: 'user' as const,
        content: 'describe',
        images: [{ data: 'base64data', mimeType: 'image/jpeg' }],
      };
      const result = provider.processMessage(msg) as unknown as Record<string, unknown>;
      const content = result.content as unknown[];
      expect(content).toHaveLength(2);
      expect((content[1] as Record<string, unknown>).type).toBe('image');
      expect(((content[1] as Record<string, unknown>).source as Record<string, unknown>).type).toBe('base64');
    });

    it('assistant 角色保持不变', () => {
      const msg = { role: 'assistant' as const, content: 'response' };
      const result = provider.processMessage(msg) as unknown as Record<string, unknown>;
      expect(result.role).toBe('assistant');
    });

    it('无图片时 system 角色保持不变', () => {
      const msg = { role: 'system' as const, content: 'instruction' };
      const result = provider.processMessage(msg) as unknown as Record<string, unknown>;
      expect(result.role).toBe('system');
    });

    it('有图片时非 assistant 角色转为 user', () => {
      const msg = {
        role: 'system' as const,
        content: 'instruction',
        images: [{ data: 'base64', mimeType: 'image/png' }],
      };
      const result = provider.processMessage(msg) as unknown as Record<string, unknown>;
      expect(result.role).toBe('user');
    });
  });
});

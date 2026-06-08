import { describe, it, expect } from 'vitest';
import { getProvider, getRegisteredTypes } from './registry';

describe('registry', () => {
  describe('getRegisteredTypes', () => {
    it('应包含 openai、anthropic 和 ollama', () => {
      const types = getRegisteredTypes();
      expect(types).toContain('openai');
      expect(types).toContain('anthropic');
      expect(types).toContain('ollama');
    });
  });

  describe('getProvider', () => {
    it('应返回 OpenAI provider', () => {
      const provider = getProvider('openai');
      expect(provider.type).toBe('openai');
    });

    it('应返回 Anthropic provider', () => {
      const provider = getProvider('anthropic');
      expect(provider.type).toBe('anthropic');
    });

    it('应返回 Ollama provider', () => {
      const provider = getProvider('ollama');
      expect(provider.type).toBe('ollama');
    });

    it('不支持的类型应抛出错误', () => {
      expect(() => getProvider('unknown')).toThrow('Unsupported provider type');
    });
  });
});

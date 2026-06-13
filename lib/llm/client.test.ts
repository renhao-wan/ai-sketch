import { describe, it, expect } from 'vitest';

/**
 * LLM Client 测试
 *
 * 注意：callLLM、fetchWithRetry、fetchModels、testConnection 依赖网络调用（proxyFetch），
 * 需要 mock 才能测试。此处测试可独立运行的纯函数。
 *
 * isRetryableNetworkError 和 parseModelsResponse 未导出，
 * 通过其公开行为间接测试。
 */

describe('LLM Client', () => {
  describe('URL 校验行为（通过 fetchModels 间接测试）', () => {
    // fetchModels 内部调用 validateBaseUrl，我们通过它来测试 URL 校验
    // 由于 fetchModels 依赖 proxyFetch，这里只测试会抛出异常的无效 URL

    it('无效 URL 应抛出错误', async () => {
      // 动态导入以避免模块加载时的副作用
      const { fetchModels } = await import('./client');
      await expect(fetchModels('openai', 'not-a-url', 'key')).rejects.toThrow('无效的 URL');
    });

    it('非 http/https 协议应抛出错误', async () => {
      const { fetchModels } = await import('./client');
      await expect(fetchModels('openai', 'ftp://example.com', 'key')).rejects.toThrow('http 或 https');
    });

    it('file:// 协议应抛出错误', async () => {
      const { fetchModels } = await import('./client');
      await expect(fetchModels('openai', 'file:///etc/passwd', 'key')).rejects.toThrow('http 或 https');
    });
  });

  describe('callLLM URL 校验', () => {
    it('无效 baseUrl 应抛出错误', async () => {
      const { callLLM } = await import('./client');
      const config = {
        name: 'test',
        type: 'openai' as const,
        baseUrl: 'invalid',
        apiKey: 'key',
        model: 'gpt-4',
      };
      await expect(callLLM(config, [{ role: 'user', content: 'hi' }])).rejects.toThrow('无效的 URL');
    });
  });

  describe('testConnection 错误处理', () => {
    it('无效 URL 应返回连接失败', async () => {
      const { testConnection } = await import('./client');
      const config = {
        name: 'test',
        type: 'openai' as const,
        baseUrl: 'invalid-url',
        apiKey: 'key',
        model: 'gpt-4',
      };
      const result = await testConnection(config);
      expect(result.success).toBe(false);
      expect(result.message).toContain('连接失败');
    });
  });
});

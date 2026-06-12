/**
 * 代理管理器
 * 负责管理 LLM 请求的代理配置，支持从数据库动态读取和环境变量回退
 * 同时提供代理感知的 proxyFetch 封装，供 client.ts 和 vision-proxy.ts 复用
 */

import { ProxyAgent } from 'undici';
import { fetch as undiciFetch } from 'undici';

/** 允许的代理 URL 协议 */
const VALID_PROXY_PROTOCOLS = ['http:', 'https:', 'socks4:', 'socks5:'];

/** 代理管理器 */
class ProxyManager {
  private agent: ProxyAgent | undefined;
  private proxyUrl: string | null = null;
  private lastCheck = 0;
  private hasChecked = false;
  private readonly CACHE_TTL = 5000; // 5 秒缓存

  /**
   * 获取代理 Agent（带缓存）
   * 优先从数据库读取配置，回退到环境变量
   */
  async getAgent(): Promise<ProxyAgent | undefined> {
    const now = Date.now();
    if (now - this.lastCheck < this.CACHE_TTL && this.hasChecked) {
      return this.agent;
    }
    this.lastCheck = now;
    this.hasChecked = true;

    try {
      const { configManager } = await import('@/lib/db/config-manager');
      const { proxyUrl, proxyEnabled } = await configManager.getProxy();

      if (proxyEnabled && proxyUrl) {
        if (proxyUrl !== this.proxyUrl) {
          await this.replaceAgent(proxyUrl);
        }
        return this.agent;
      }
    } catch {
      // DB 不可用时回退到环境变量
    }

    // 回退：环境变量
    const envProxy = process.env.HTTPS_PROXY || process.env.https_proxy
      || process.env.HTTP_PROXY || process.env.http_proxy;

    if (envProxy) {
      if (envProxy !== this.proxyUrl) {
        await this.replaceAgent(envProxy);
      }
      return this.agent;
    }

    // 无代理时，清除旧的 agent
    await this.clearAgent();
    return undefined;
  }

  /**
   * 替换代理 Agent
   * 关闭旧实例，创建新实例，避免连接泄漏
   */
  private async replaceAgent(url: string): Promise<void> {
    // 校验代理 URL 协议格式
    try {
      const parsed = new URL(url);
      if (!VALID_PROXY_PROTOCOLS.includes(parsed.protocol)) {
        console.warn(`[ProxyManager] 不支持的代理协议: ${parsed.protocol}，仅支持 ${VALID_PROXY_PROTOCOLS.join(', ')}`);
        this.proxyUrl = null;
        return;
      }
    } catch {
      console.warn(`[ProxyManager] 无效的代理 URL: ${url}`);
      this.proxyUrl = null;
      return;
    }

    await this.closeAgent();
    this.proxyUrl = url;
    this.agent = new ProxyAgent(url);
  }

  /**
   * 关闭当前 Agent
   */
  private async closeAgent(): Promise<void> {
    if (this.agent) {
      try {
        await this.agent.close();
      } catch {
        // 忽略关闭错误
      }
      this.agent = undefined;
    }
  }

  /**
   * 清除代理配置
   */
  private async clearAgent(): Promise<void> {
    await this.closeAgent();
    this.proxyUrl = null;
  }

  /**
   * 关闭管理器，释放资源
   * 在应用退出时调用
   */
  async close(): Promise<void> {
    await this.closeAgent();
    this.proxyUrl = null;
    this.lastCheck = 0;
    this.hasChecked = false;
  }
}

/** 单例导出 */
export const proxyManager = new ProxyManager();

/**
 * 代理感知的 fetch 封装
 * 有代理时用 undici.fetch + ProxyAgent，无代理时用全局 fetch
 * 注意: undici.fetch 的 dispatcher 参数未被标准 RequestInit 类型覆盖，
 * 因此需要类型断言；返回值类型与全局 fetch 兼容但签名不同，需双重断言。
 */
export async function proxyFetch(url: string, options?: RequestInit): Promise<Response> {
  const agent = await proxyManager.getAgent();
  if (agent) {
    return undiciFetch(url, { ...options, dispatcher: agent } as any) as unknown as Promise<Response>;
  }
  return fetch(url, options);
}

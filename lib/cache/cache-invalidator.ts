/**
 * 缓存失效器
 * 在配置变更/删除时自动清除相关缓存
 */

import { cacheManager } from '@/lib/db/cache-manager';

class CacheInvalidator {
  /**
   * 按配置失效缓存
   * 当配置的 model 或 name 变更时调用
   */
  async invalidateByConfig(configName: string, model: string): Promise<number> {
    return cacheManager.clearByConfig(configName, model);
  }

  /** 清除所有缓存 */
  async invalidateAll(): Promise<void> {
    return cacheManager.clearAll();
  }

  /** 清除过期缓存 */
  async invalidateExpired(): Promise<number> {
    return cacheManager.clearExpired();
  }
}

export const cacheInvalidator = new CacheInvalidator();
export default CacheInvalidator;

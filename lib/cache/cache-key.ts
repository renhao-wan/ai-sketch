/**
 * 统一缓存键生成器
 * 确保 generate route 和 cache-manager 使用完全一致的缓存键逻辑
 */

import type { DiagramFormat } from '@/lib/types/diagram-strategy';

interface CacheKeyInput {
  prompt: string;
  format: DiagramFormat;
  chartType: string;
  model: string;
  configName: string;
  mode?: string;
}

/** SHA-256 哈希，取前 16 位 hex */
async function sha256(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

/**
 * 构建缓存键
 * 所有可能影响 LLM 输出的因素都应包含在内（不含对话上下文，提高命中率）
 */
export async function buildCacheKey(input: CacheKeyInput): Promise<string> {
  const parts = [
    input.prompt,
    input.format,
    input.chartType,
    input.model,
    input.configName,
    input.mode ?? '',
  ].join('|');
  return sha256(parts);
}

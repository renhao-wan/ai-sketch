/**
 * 统一缓存键生成器
 * 支持三档缓存：严格（6因素）、中等（4因素）、宽松（2因素）
 */

import type { DiagramFormat } from '@/lib/types/diagram-strategy';

/** 缓存档位 */
export type CacheLevel = 'strict' | 'normal' | 'loose';

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

/** 各档位使用的因素 */
const CACHE_LEVEL_FACTORS: Record<CacheLevel, (keyof CacheKeyInput)[]> = {
  strict: ['prompt', 'format', 'chartType', 'model', 'configName', 'mode'],
  normal: ['prompt', 'format', 'chartType', 'model'],
  loose:  ['prompt', 'format'],
};

/**
 * 构建单个档位的缓存键
 */
async function buildKeyForLevel(input: CacheKeyInput, level: CacheLevel): Promise<string> {
  const factors = CACHE_LEVEL_FACTORS[level];
  const parts = factors.map(f => {
    const val = input[f];
    return val ?? '';
  }).join('|');
  return sha256(parts);
}

/**
 * 构建三档缓存键
 * @returns { strict, normal, loose } 三个档位的缓存键
 */
export async function buildCacheKeys(input: CacheKeyInput): Promise<{
  strict: string;
  normal: string;
  loose: string;
}> {
  const [strict, normal, loose] = await Promise.all([
    buildKeyForLevel(input, 'strict'),
    buildKeyForLevel(input, 'normal'),
    buildKeyForLevel(input, 'loose'),
  ]);
  return { strict, normal, loose };
}

/**
 * 构建指定档位的缓存键（向后兼容）
 */
export async function buildCacheKey(input: CacheKeyInput, level: CacheLevel = 'normal'): Promise<string> {
  return buildKeyForLevel(input, level);
}

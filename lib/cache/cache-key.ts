/**
 * 统一缓存键生成器
 * 确保 generate route 和 cache-manager 使用完全一致的缓存键逻辑
 */

import type { DiagramFormat } from '@/lib/types/diagram-strategy';
import type { LLMMessage } from '@/lib/types';

interface CacheKeyInput {
  prompt: string;
  format: DiagramFormat;
  chartType: string;
  model: string;
  configName: string;
  contextHash?: string;
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
 * 所有可能影响 LLM 输出的因素都应包含在内
 */
export async function buildCacheKey(input: CacheKeyInput): Promise<string> {
  const parts = [
    input.prompt,
    input.format,
    input.chartType,
    input.model,
    input.configName,
    input.contextHash ?? '',
  ].join('|');
  return sha256(parts);
}

/**
 * 构建多轮对话上下文哈希
 * 取最近 N 条消息的内容做哈希，避免全量上下文导致命中率过低
 *
 * @param messages 完整消息列表
 * @param maxMessages 取最近几条（默认 6）
 */
export async function buildContextHash(
  messages: LLMMessage[],
  maxMessages = 6,
): Promise<string> {
  const recent = messages.slice(-maxMessages);
  const content = recent.map(m => `${m.role}:${typeof m.content === 'string' ? m.content : '[multimodal]'}`).join('\n');
  const hash = await sha256(content);
  return hash.substring(0, 8);
}

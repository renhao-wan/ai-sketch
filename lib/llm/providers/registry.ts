/**
 * LLM Provider 注册表
 * 统一管理所有 provider 实例
 */

import type { LLMProvider } from './types';
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { OllamaProvider } from './ollama';

/** Provider 注册表 */
const providers: Record<string, LLMProvider> = {
  openai: new OpenAIProvider(),
  anthropic: new AnthropicProvider(),
  ollama: new OllamaProvider(),
};

/**
 * 获取指定类型的 provider
 * @param type provider 类型
 * @throws 如果 provider 不存在则抛出错误
 */
export function getProvider(type: string): LLMProvider {
  const provider = providers[type];
  if (!provider) {
    throw new Error(`Unsupported provider type: ${type}`);
  }
  return provider;
}

/**
 * 获取所有已注册的 provider 类型
 */
export function getRegisteredTypes(): string[] {
  return Object.keys(providers);
}

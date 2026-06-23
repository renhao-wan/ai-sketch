import type { LLMConfig } from '@/lib/types';

/**
 * Check if configuration is valid and complete
 * Ollama provider 不需要 API Key
 */
export function isConfigValid(config: LLMConfig | null): boolean {
  if (!config) return false;
  if (!config.type || !config.baseUrl || !config.model) return false;
  // Ollama 不需要 API Key
  if (config.type === 'ollama') return true;
  return !!config.apiKey;
}

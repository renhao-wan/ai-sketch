import type { LLMConfig } from '@/types';

/**
 * Check if configuration is valid and complete
 */
export function isConfigValid(config: LLMConfig | null): boolean {
  if (!config) return false;
  return !!(config.type && config.baseUrl && config.apiKey && config.model);
}

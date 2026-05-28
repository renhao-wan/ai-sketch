import { configManager } from './config-manager';
import type { LLMConfig } from '@/types';

/**
 * Get the current active provider configuration
 */
export async function getConfig(): Promise<LLMConfig | null> {
  return configManager.getActiveConfig();
}

/**
 * Save provider configuration
 */
export async function saveConfig(config: Partial<LLMConfig>): Promise<void> {
  const activeConfig = await configManager.getActiveConfig();
  if (activeConfig) {
    await configManager.updateConfig(activeConfig.id!, config);
  } else {
    const newConfig = await configManager.createConfig(config);
    await configManager.setActiveConfig(newConfig.id!);
  }
}

export { configManager };

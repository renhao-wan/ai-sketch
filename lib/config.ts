/**
 * Configuration management for LLM providers
 * Backward compatibility layer for the new multi-config system
 */

import { configManager } from './config-manager';
import type { LLMConfig } from '@/types';

const LEGACY_CONFIG_KEY = 'smart-excalidraw-config';

/**
 * Migration: Check if there's an old single config and migrate it
 */
function migrateLegacyConfig(): void {
  if (typeof window === 'undefined') return;

  try {
    const legacyConfig = localStorage.getItem(LEGACY_CONFIG_KEY);
    if (legacyConfig && configManager.getAllConfigs().length === 0) {
      const config = JSON.parse(legacyConfig);
      configManager.createConfig({
        name: config.name || '迁移的配置',
        type: config.type,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.model,
        description: '从旧版本迁移的配置',
      });

      localStorage.removeItem(LEGACY_CONFIG_KEY);
    }
  } catch (error) {
    console.error('Failed to migrate legacy config:', error);
  }
}

/**
 * Get the current provider configuration (backward compatibility)
 */
export function getConfig(): LLMConfig | null {
  if (typeof window === 'undefined') return null;

  migrateLegacyConfig();

  const activeConfig = configManager.getActiveConfig();
  if (!activeConfig) return null;

  return {
    name: activeConfig.name,
    type: activeConfig.type,
    baseUrl: activeConfig.baseUrl,
    apiKey: activeConfig.apiKey,
    model: activeConfig.model,
  };
}

/**
 * Save provider configuration (backward compatibility)
 */
export function saveConfig(config: Partial<LLMConfig>): void {
  if (typeof window === 'undefined') return;

  migrateLegacyConfig();

  try {
    const activeConfig = configManager.getActiveConfig();
    if (activeConfig) {
      configManager.updateConfig(activeConfig.id!, config);
    } else {
      const newConfig = configManager.createConfig(config);
      configManager.setActiveConfig(newConfig.id!);
    }
  } catch (error) {
    console.error('Failed to save config:', error);
    throw error;
  }
}

/**
 * Check if configuration is valid and complete
 */
export function isConfigValid(config: LLMConfig | null): boolean {
  if (!config) return false;

  return !!(
    config.type &&
    config.baseUrl &&
    config.apiKey &&
    config.model
  );
}

export { configManager };

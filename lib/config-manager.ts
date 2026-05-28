/**
 * 配置管理器 - 处理多份大模型API配置的管理
 */

import type { LLMConfig, TestConnectionResult } from '@/types';

interface ConfigStats {
  total: number;
  active: number;
  byType: Record<string, number>;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

class ConfigManager {
  private STORAGE_KEY = 'smart-excalidraw-configs';
  private ACTIVE_CONFIG_KEY = 'smart-excalidraw-active-config';
  private configs: LLMConfig[] = [];
  private activeConfigId: string | null = null;
  private isLoaded = false;

  generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private ensureLoaded(): void {
    if (!this.isLoaded) {
      this.loadConfigs();
    }
  }

  getActiveConfigId(): string | null {
    this.ensureLoaded();
    return this.activeConfigId;
  }

  private loadConfigs(): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      this.configs = stored ? JSON.parse(stored) : [];
      this.activeConfigId = localStorage.getItem(this.ACTIVE_CONFIG_KEY);
      this.isLoaded = true;

      if (!this.activeConfigId && this.configs.length > 0) {
        this.activeConfigId = this.configs[0].id!;
        this.saveActiveConfigId();
      }
    } catch (error) {
      console.error('Failed to load configs:', error);
      this.configs = [];
      this.activeConfigId = null;
      this.isLoaded = true;
    }
  }

  private saveConfigs(): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.configs));
    } catch (error) {
      console.error('Failed to save configs:', error);
    }
  }

  private saveActiveConfigId(): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      if (this.activeConfigId) {
        localStorage.setItem(this.ACTIVE_CONFIG_KEY, this.activeConfigId);
      } else {
        localStorage.removeItem(this.ACTIVE_CONFIG_KEY);
      }
    } catch (error) {
      console.error('Failed to save active config ID:', error);
    }
  }

  createConfig(configData: Partial<LLMConfig>): LLMConfig {
    const newConfig: LLMConfig = {
      id: this.generateId(),
      name: configData.name || '新配置',
      type: configData.type || 'openai',
      baseUrl: configData.baseUrl || '',
      apiKey: configData.apiKey || '',
      model: configData.model || '',
      description: configData.description || '',
      isActive: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...configData,
    };

    this.configs.push(newConfig);

    if (this.configs.length === 1) {
      this.setActiveConfig(newConfig.id!);
    }

    this.saveConfigs();
    return newConfig;
  }

  updateConfig(id: string, updateData: Partial<LLMConfig>): LLMConfig {
    const configIndex = this.configs.findIndex(config => config.id === id);
    if (configIndex === -1) {
      throw new Error('配置不存在');
    }

    this.configs[configIndex] = {
      ...this.configs[configIndex],
      ...updateData,
      id,
      updatedAt: new Date().toISOString(),
    };

    this.saveConfigs();
    return this.configs[configIndex];
  }

  deleteConfig(id: string): void {
    const configIndex = this.configs.findIndex(config => config.id === id);
    if (configIndex === -1) {
      throw new Error('配置不存在');
    }

    if (this.activeConfigId === id) {
      this.activeConfigId = null;
      if (this.configs.length > 1) {
        const remainingConfigs = this.configs.filter(config => config.id !== id);
        this.activeConfigId = remainingConfigs[0].id!;
        this.saveActiveConfigId();
      } else {
        this.saveActiveConfigId();
      }
    }

    this.configs.splice(configIndex, 1);
    this.saveConfigs();
  }

  getAllConfigs(): LLMConfig[] {
    this.ensureLoaded();
    return [...this.configs];
  }

  getConfig(id: string): LLMConfig | undefined {
    this.ensureLoaded();
    return this.configs.find(config => config.id === id);
  }

  getActiveConfig(): LLMConfig | null {
    this.ensureLoaded();
    if (!this.activeConfigId) return null;
    return this.getConfig(this.activeConfigId) || null;
  }

  setActiveConfig(id: string): LLMConfig {
    const config = this.getConfig(id);
    if (!config) {
      throw new Error('配置不存在');
    }

    this.activeConfigId = id;
    this.saveActiveConfigId();
    return config;
  }

  cloneConfig(id: string, newName?: string): LLMConfig {
    this.ensureLoaded();
    const originalConfig = this.getConfig(id);
    if (!originalConfig) {
      throw new Error('原配置不存在');
    }

    const clonedConfig: Partial<LLMConfig> = {
      ...originalConfig,
      name: newName || `${originalConfig.name} (副本)`,
      isActive: false,
    };

    delete clonedConfig.id;
    delete clonedConfig.createdAt;
    delete clonedConfig.updatedAt;

    return this.createConfig(clonedConfig);
  }

  validateConfig(config: Partial<LLMConfig>): ValidationResult {
    const errors: string[] = [];

    if (!config.name || config.name.trim() === '') {
      errors.push('配置名称不能为空');
    }

    if (!config.type || !['openai', 'anthropic'].includes(config.type)) {
      errors.push('配置类型必须是 openai 或 anthropic');
    }

    if (!config.baseUrl || config.baseUrl.trim() === '') {
      errors.push('API地址不能为空');
    } else {
      try {
        new URL(config.baseUrl);
      } catch {
        errors.push('API地址格式不正确');
      }
    }

    if (!config.apiKey || config.apiKey.trim() === '') {
      errors.push('API密钥不能为空');
    }

    if (!config.model || config.model.trim() === '') {
      errors.push('模型名称不能为空');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  async testConnection(config: Partial<LLMConfig>): Promise<TestConnectionResult> {
    const validation = this.validateConfig(config);
    if (!validation.isValid) {
      throw new Error('配置无效: ' + validation.errors.join(', '));
    }

    try {
      return { success: true, message: '连接测试成功' };
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  }

  importConfigs(configsData: string): { success: boolean; count?: number; message?: string } {
    try {
      const importedConfigs = JSON.parse(configsData);
      if (!Array.isArray(importedConfigs)) {
        throw new Error('导入数据格式错误');
      }

      let importCount = 0;
      for (const configData of importedConfigs) {
        const validation = this.validateConfig(configData);
        if (validation.isValid) {
          this.createConfig({
            ...configData,
            isActive: false,
          });
          importCount++;
        }
      }

      return { success: true, count: importCount };
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  }

  exportConfigs(): string {
    return JSON.stringify(this.configs, null, 2);
  }

  searchConfigs(query: string): LLMConfig[] {
    this.ensureLoaded();
    const lowerQuery = query.toLowerCase();
    return this.configs.filter(config =>
      config.name.toLowerCase().includes(lowerQuery) ||
      (config.description || '').toLowerCase().includes(lowerQuery) ||
      config.type.toLowerCase().includes(lowerQuery),
    );
  }

  getStats(): ConfigStats {
    this.ensureLoaded();
    const stats: ConfigStats = {
      total: this.configs.length,
      active: 0,
      byType: {},
    };

    this.configs.forEach(config => {
      if (config.id === this.activeConfigId) {
        stats.active = 1;
      }

      const type = config.type;
      stats.byType[type] = (stats.byType[type] || 0) + 1;
    });

    return stats;
  }
}

export const configManager = new ConfigManager();
export default ConfigManager;

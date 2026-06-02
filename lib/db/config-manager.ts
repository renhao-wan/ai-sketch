import { getDb, saveToDisk } from './index';
import { testConnection } from '@/lib/llm/client';
import { generateId } from '@/lib/utils';
import type { LLMConfig, TestConnectionResult } from '@/lib/types';

interface ConfigStats {
  total: number;
  active: number;
  byType: Record<string, number>;
}

interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
}

interface ConfigRow {
  id: string;
  name: string;
  type: string;
  base_url: string;
  api_key: string;
  model: string;
  description: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

function rowToConfig(row: ConfigRow): LLMConfig {
  return {
    id: row.id,
    name: row.name,
    type: row.type as 'openai' | 'anthropic',
    baseUrl: row.base_url,
    apiKey: row.api_key,
    model: row.model,
    description: row.description,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class ConfigManager {
  generateId = generateId;

  async getAllConfigs(): Promise<LLMConfig[]> {
    const db = await getDb();
    const result = db.exec('SELECT * FROM llm_configs ORDER BY created_at DESC');
    if (result.length === 0) return [];
    return result[0].values.map((row: unknown[]) =>
      rowToConfig({
        id: row[0] as string,
        name: row[1] as string,
        type: row[2] as string,
        base_url: row[3] as string,
        api_key: row[4] as string,
        model: row[5] as string,
        description: row[6] as string,
        is_active: row[7] as number,
        created_at: row[8] as string,
        updated_at: row[9] as string,
      }),
    );
  }

  async getConfig(id: string): Promise<LLMConfig | undefined> {
    const db = await getDb();
    const stmt = db.prepare('SELECT * FROM llm_configs WHERE id = ?');
    stmt.bind([id]);
    if (!stmt.step()) {
      stmt.free();
      return undefined;
    }
    const row = stmt.getAsObject() as Record<string, unknown>;
    stmt.free();
    return rowToConfig({
      id: row.id as string,
      name: row.name as string,
      type: row.type as string,
      base_url: row.base_url as string,
      api_key: row.api_key as string,
      model: row.model as string,
      description: row.description as string,
      is_active: row.is_active as number,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    });
  }

  async getActiveConfig(): Promise<LLMConfig | null> {
    const activeId = await this.getActiveConfigId();
    if (!activeId) return null;
    const config = await this.getConfig(activeId);
    return config || null;
  }

  async getActiveConfigId(): Promise<string | null> {
    const db = await getDb();
    const result = db.exec("SELECT value FROM meta WHERE key = 'active_config_id'");
    if (result.length === 0 || result[0].values.length === 0) return null;
    return result[0].values[0][0] as string;
  }

  async createConfig(configData: Partial<LLMConfig>): Promise<LLMConfig> {
    const db = await getDb();
    const id = this.generateId();
    const now = new Date().toISOString();

    const newConfig: LLMConfig = {
      id,
      name: configData.name || '新配置',
      type: configData.type || 'openai',
      baseUrl: configData.baseUrl || '',
      apiKey: configData.apiKey || '',
      model: configData.model || '',
      description: configData.description || '',
      isActive: false,
      createdAt: now,
      updatedAt: now,
    };

    db.run(
      `INSERT INTO llm_configs (id, name, type, base_url, api_key, model, description, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newConfig.id!,
        newConfig.name,
        newConfig.type,
        newConfig.baseUrl,
        newConfig.apiKey,
        newConfig.model,
        newConfig.description || '',
        0,
        newConfig.createdAt!,
        newConfig.updatedAt!,
      ],
    );

    const allConfigs = await this.getAllConfigs();
    if (allConfigs.length === 1) {
      await this.setActiveConfig(id);
    }

    saveToDisk();
    return newConfig;
  }

  async updateConfig(id: string, updateData: Partial<LLMConfig>): Promise<LLMConfig> {
    const db = await getDb();
    const existing = await this.getConfig(id);
    if (!existing) throw new Error('配置不存在');

    const now = new Date().toISOString();
    const merged = { ...existing, ...updateData, id, updatedAt: now };

    db.run(
      `UPDATE llm_configs SET name = ?, type = ?, base_url = ?, api_key = ?, model = ?, description = ?, is_active = ?, updated_at = ? WHERE id = ?`,
      [
        merged.name,
        merged.type,
        merged.baseUrl,
        merged.apiKey,
        merged.model,
        merged.description || '',
        merged.isActive ? 1 : 0,
        merged.updatedAt!,
        id,
      ],
    );

    saveToDisk();
    return merged;
  }

  async deleteConfig(id: string): Promise<void> {
    const db = await getDb();
    const existing = await this.getConfig(id);
    if (!existing) throw new Error('配置不存在');

    const activeId = await this.getActiveConfigId();
    if (activeId === id) {
      db.run("DELETE FROM meta WHERE key = 'active_config_id'");
      const remaining = await this.getAllConfigs();
      const filtered = remaining.filter((c) => c.id !== id);
      if (filtered.length > 0) {
        db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('active_config_id', ?)", [filtered[0].id!]);
      }
    }

    db.run('DELETE FROM llm_configs WHERE id = ?', [id]);
    saveToDisk();
  }

  async setActiveConfig(id: string): Promise<LLMConfig> {
    const config = await this.getConfig(id);
    if (!config) throw new Error('配置不存在');

    const db = await getDb();
    db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('active_config_id', ?)", [id]);
    saveToDisk();
    return config;
  }

  async cloneConfig(id: string, newName?: string): Promise<LLMConfig> {
    const original = await this.getConfig(id);
    if (!original) throw new Error('原配置不存在');

    return this.createConfig({
      name: newName || `${original.name} (副本)`,
      type: original.type,
      baseUrl: original.baseUrl,
      apiKey: original.apiKey,
      model: original.model,
      description: original.description,
    });
  }

  validateConfig(config: Partial<LLMConfig>): ConfigValidationResult {
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

    return { isValid: errors.length === 0, errors };
  }

  async testConnectionAction(config: Partial<LLMConfig>): Promise<TestConnectionResult> {
    const validation = this.validateConfig(config);
    if (!validation.isValid) {
      throw new Error('配置无效: ' + validation.errors.join(', '));
    }
    return testConnection(config as LLMConfig);
  }

  async importConfigs(configsData: string): Promise<{ success: boolean; count?: number; message?: string }> {
    try {
      const importedConfigs = JSON.parse(configsData);
      if (!Array.isArray(importedConfigs)) throw new Error('导入数据格式错误');

      let importCount = 0;
      for (const configData of importedConfigs) {
        const validation = this.validateConfig(configData);
        if (validation.isValid) {
          await this.createConfig({ ...configData, isActive: false });
          importCount++;
        }
      }
      return { success: true, count: importCount };
    } catch (error) {
      return { success: false, message: (error as Error).message };
    }
  }

  async exportConfigs(): Promise<string> {
    const configs = await this.getAllConfigs();
    return JSON.stringify(configs, null, 2);
  }

  async searchConfigs(query: string): Promise<LLMConfig[]> {
    const db = await getDb();
    const lowerQuery = `%${query.toLowerCase()}%`;
    const result = db.exec(
      `SELECT * FROM llm_configs WHERE LOWER(name) LIKE ? OR LOWER(description) LIKE ? OR LOWER(type) LIKE ? ORDER BY created_at DESC`,
      [lowerQuery, lowerQuery, lowerQuery],
    );
    if (result.length === 0) return [];
    return result[0].values.map((row: unknown[]) =>
      rowToConfig({
        id: row[0] as string,
        name: row[1] as string,
        type: row[2] as string,
        base_url: row[3] as string,
        api_key: row[4] as string,
        model: row[5] as string,
        description: row[6] as string,
        is_active: row[7] as number,
        created_at: row[8] as string,
        updated_at: row[9] as string,
      }),
    );
  }

  async getStats(): Promise<ConfigStats> {
    const configs = await this.getAllConfigs();
    const activeId = await this.getActiveConfigId();
    const stats: ConfigStats = { total: configs.length, active: 0, byType: {} };

    configs.forEach((config) => {
      if (config.id === activeId) stats.active = 1;
      stats.byType[config.type] = (stats.byType[config.type] || 0) + 1;
    });

    return stats;
  }
}

export const configManager = new ConfigManager();
export default ConfigManager;

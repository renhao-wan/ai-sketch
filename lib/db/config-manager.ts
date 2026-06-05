import { getDb, requestSave } from './index';
import { withTransaction } from './transaction';
import { encrypt, decrypt, isEncrypted } from './crypto';
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
  created_at: number;
  updated_at: number;
}

/** 将数据库行对象解析为 LLMConfig */
function rowToConfig(row: Record<string, unknown>): LLMConfig {
  const rawKey = row.api_key as string;
  // 兼容读取：未加密的明文直接返回，已加密的解密后返回
  const apiKey = isEncrypted(rawKey) ? decrypt(rawKey) : rawKey;
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as 'openai' | 'anthropic',
    baseUrl: row.base_url as string,
    apiKey,
    model: row.model as string,
    description: row.description as string,
    isActive: (row.is_active as number) === 1,
    temperature: (row.temperature as number) ?? 0.5,
    maxTokens: row.max_tokens != null ? (row.max_tokens as number) : undefined,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

class ConfigManager {
  generateId = generateId;

  async getAllConfigs(): Promise<LLMConfig[]> {
    const db = await getDb();
    const stmt = db.prepare('SELECT * FROM llm_configs ORDER BY created_at DESC');
    const configs: LLMConfig[] = [];
    try {
      while (stmt.step()) {
        configs.push(rowToConfig(stmt.getAsObject() as Record<string, unknown>));
      }
    } finally {
      stmt.free();
    }
    return configs;
  }

  async getConfig(id: string): Promise<LLMConfig | undefined> {
    const db = await getDb();
    const stmt = db.prepare('SELECT * FROM llm_configs WHERE id = ?');
    try {
      stmt.bind([id]);
      if (!stmt.step()) {
        return undefined;
      }
      const row = stmt.getAsObject() as Record<string, unknown>;
      return rowToConfig({
        id: row.id as string,
        name: row.name as string,
        type: row.type as string,
        base_url: row.base_url as string,
        api_key: row.api_key as string,
        model: row.model as string,
        description: row.description as string,
        is_active: row.is_active as number,
        created_at: row.created_at as number,
        updated_at: row.updated_at as number,
      });
    } finally {
      stmt.free();
    }
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
    const now = Date.now();

    const newConfig: LLMConfig = {
      id,
      name: configData.name || '新配置',
      type: configData.type || 'openai',
      baseUrl: configData.baseUrl || '',
      apiKey: configData.apiKey || '',
      model: configData.model || '',
      description: configData.description || '',
      isActive: false,
      temperature: configData.temperature ?? 0.5,
      maxTokens: configData.maxTokens,
      createdAt: now,
      updatedAt: now,
    };

    withTransaction(db, () => {
      db.run(
        `INSERT INTO llm_configs (id, name, type, base_url, api_key, model, description, is_active, temperature, max_tokens, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newConfig.id!,
          newConfig.name,
          newConfig.type,
          newConfig.baseUrl,
          encrypt(newConfig.apiKey),
          newConfig.model,
          newConfig.description || '',
          0,
          newConfig.temperature ?? 0.5,
          newConfig.maxTokens ?? null,
          newConfig.createdAt!,
          newConfig.updatedAt!,
        ],
      );

      // 用 COUNT(*) 替代全量 SELECT 判断是否是第一条配置
      const countResult = db.exec('SELECT COUNT(*) FROM llm_configs');
      const count = countResult.length > 0 ? (countResult[0].values[0][0] as number) : 0;
      if (count === 1) {
        db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('active_config_id', ?)", [id]);
      }
    });

    return newConfig;
  }

  async updateConfig(id: string, updateData: Partial<LLMConfig>): Promise<LLMConfig> {
    const db = await getDb();
    const existing = await this.getConfig(id);
    if (!existing) throw new Error('配置不存在');

    const now = Date.now();
    const merged = { ...existing, ...updateData, id, updatedAt: now };

    db.run(
      `UPDATE llm_configs SET name = ?, type = ?, base_url = ?, api_key = ?, model = ?, description = ?, is_active = ?, temperature = ?, max_tokens = ?, updated_at = ? WHERE id = ?`,
      [
        merged.name,
        merged.type,
        merged.baseUrl,
        encrypt(merged.apiKey),
        merged.model,
        merged.description || '',
        merged.isActive ? 1 : 0,
        merged.temperature ?? 0.5,
        merged.maxTokens ?? null,
        merged.updatedAt!,
        id,
      ],
    );

    requestSave();
    return merged;
  }

  async deleteConfig(id: string): Promise<void> {
    const db = await getDb();
    const existing = await this.getConfig(id);
    if (!existing) throw new Error('配置不存在');

    // 在事务外查询活跃配置 ID，避免 BEGIN 后 await（为未来异步数据库驱动兼容）
    const activeId = await this.getActiveConfigId();

    withTransaction(db, () => {
      if (activeId === id) {
        db.run("DELETE FROM meta WHERE key = 'active_config_id'");
        // 用 SQL 查询替代全量加载
        const remaining = db.exec('SELECT id FROM llm_configs WHERE id != ? ORDER BY created_at DESC LIMIT 1', [id]);
        if (remaining.length > 0 && remaining[0].values.length > 0) {
          db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('active_config_id', ?)", [remaining[0].values[0][0] as string]);
        }
      }

      db.run('DELETE FROM llm_configs WHERE id = ?', [id]);
    });
  }

  async setActiveConfig(id: string): Promise<LLMConfig> {
    const config = await this.getConfig(id);
    if (!config) throw new Error('配置不存在');

    const db = await getDb();
    db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('active_config_id', ?)", [id]);
    requestSave();
    return config;
  }

  async cloneConfig(id: string, newName?: string): Promise<LLMConfig> {
    const original = await this.getConfig(id);
    if (!original) throw new Error('原配置不存在');

    // 自动生成带编号的名称：查找已有同名配置的最大编号
    const baseName = newName || original.name;
    const allConfigs = await this.getAllConfigs();
    const pattern = new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\((\\d+)\\)$`);
    let maxNum = 0;
    for (const cfg of allConfigs) {
      const match = cfg.name.match(pattern);
      if (match) {
        maxNum = Math.max(maxNum, parseInt(match[1], 10));
      }
    }

    return this.createConfig({
      name: `${baseName} (${maxNum + 1})`,
      type: original.type,
      baseUrl: original.baseUrl,
      apiKey: original.apiKey,
      model: original.model,
      description: original.description,
      temperature: original.temperature,
      maxTokens: original.maxTokens,
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
    const stmt = db.prepare(
      `SELECT * FROM llm_configs WHERE LOWER(name) LIKE ? OR LOWER(description) LIKE ? OR LOWER(type) LIKE ? ORDER BY created_at DESC`,
    );
    const configs: LLMConfig[] = [];
    try {
      stmt.bind([lowerQuery, lowerQuery, lowerQuery]);
      while (stmt.step()) {
        configs.push(rowToConfig(stmt.getAsObject() as Record<string, unknown>));
      }
    } finally {
      stmt.free();
    }
    return configs;
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

  /** 获取代理配置 */
  async getProxy(): Promise<{ proxyUrl: string; proxyEnabled: boolean }> {
    const db = await getDb();
    const urlResult = db.exec("SELECT value FROM meta WHERE key = 'proxy_url'");
    const enabledResult = db.exec("SELECT value FROM meta WHERE key = 'proxy_enabled'");
    const proxyUrl = urlResult.length > 0 && urlResult[0].values.length > 0
      ? (urlResult[0].values[0][0] as string) : 'http://127.0.0.1:7890';
    const proxyEnabled = enabledResult.length > 0 && enabledResult[0].values.length > 0
      ? (enabledResult[0].values[0][0] as string) === 'true' : false;
    return { proxyUrl, proxyEnabled };
  }

  /** 设置代理配置 */
  async setProxy(proxyUrl: string, proxyEnabled: boolean): Promise<void> {
    const db = await getDb();
    db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('proxy_url', ?)", [proxyUrl]);
    db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('proxy_enabled', ?)", [proxyEnabled ? 'true' : 'false']);
    requestSave();
  }

  /** 获取 LLM 失败重试次数（默认 2，即最多 3 次尝试） */
  async getMaxRetries(): Promise<number> {
    const db = await getDb();
    const result = db.exec("SELECT value FROM meta WHERE key = 'llm_max_retries'");
    if (result.length === 0 || result[0].values.length === 0) return 2;
    const val = parseInt(result[0].values[0][0] as string, 10);
    return isNaN(val) ? 2 : val;
  }

  /** 设置 LLM 失败重试次数 */
  async setMaxRetries(maxRetries: number): Promise<void> {
    const db = await getDb();
    db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('llm_max_retries', ?)", [String(Math.max(0, Math.min(5, maxRetries)))]);
    requestSave();
  }

  /** 重置所有全局设置（proxy、retries、active_config_id） */
  async resetMeta(): Promise<void> {
    const db = await getDb();
    db.run("DELETE FROM meta");
    requestSave();
  }
}

export const configManager = new ConfigManager();
export default ConfigManager;

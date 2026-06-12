/**
 * Vision API 配置管理
 * 独立于主 LLM 配置，用于图片理解的多模态模型
 */

import { getDb, requestSave } from './index';
import { encrypt, decrypt, isEncrypted } from './crypto';

export interface VisionConfig {
  id: string;
  apiType: 'openai' | 'anthropic';
  baseUrl: string;
  apiKey: string;
  model: string;
  createdAt: number;
  updatedAt: number;
}

const DEFAULT_ID = 'default';

/**
 * 获取 Vision API 配置
 * 如果未配置，返回 null
 * API Key 自动解密（兼容旧的明文存储）
 */
export async function getVisionConfig(): Promise<VisionConfig | null> {
  const db = await getDb();
  const stmt = db.prepare('SELECT id, api_type, base_url, api_key, model, created_at, updated_at FROM vision_config WHERE id = ?');
  stmt.bind([DEFAULT_ID]);

  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    const rawApiKey = row.api_key as string;
    return {
      id: row.id as string,
      apiType: row.api_type as 'openai' | 'anthropic',
      baseUrl: row.base_url as string,
      // 兼容旧的明文存储：仅在已加密时解密
      apiKey: rawApiKey && isEncrypted(rawApiKey) ? decrypt(rawApiKey) : rawApiKey,
      model: row.model as string,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    };
  }

  stmt.free();
  return null;
}

/**
 * 保存 Vision API 配置（upsert）
 * API Key 以 AES-256-GCM 加密存储
 */
export async function saveVisionConfig(config: Omit<VisionConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<VisionConfig> {
  const db = await getDb();
  const now = Math.floor(Date.now() / 1000);
  const encryptedKey = encrypt(config.apiKey);

  db.run(
    `INSERT INTO vision_config (id, api_type, base_url, api_key, model, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET api_type = ?, base_url = ?, api_key = ?, model = ?, updated_at = ?`,
    [DEFAULT_ID, config.apiType, config.baseUrl, encryptedKey, config.model, now, now,
     config.apiType, config.baseUrl, encryptedKey, config.model, now],
  );

  requestSave();

  return {
    id: DEFAULT_ID,
    apiType: config.apiType,
    baseUrl: config.baseUrl,
    apiKey: config.apiKey, // 返回明文给调用方
    model: config.model,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 删除 Vision API 配置
 */
export async function deleteVisionConfig(): Promise<void> {
  const db = await getDb();
  db.run('DELETE FROM vision_config WHERE id = ?', [DEFAULT_ID]);
  requestSave();
}

/**
 * 检查 Vision API 是否已配置（baseUrl、apiKey、model 都非空）
 */
export async function isVisionConfigured(): Promise<boolean> {
  const config = await getVisionConfig();
  return !!(config?.baseUrl && config?.apiKey && config?.model);
}

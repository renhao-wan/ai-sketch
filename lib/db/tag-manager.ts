import { getDb, requestSave } from './index';
import { withTransaction } from './transaction';
import { generateId } from '@/lib/utils';
import { isEncrypted, decrypt } from './crypto';
import type { ConversationTag, ConfigTag, Conversation, LLMConfig } from '@/lib/types';
import type { DiagramFormat } from '@/lib/types/diagram-strategy';

/** 将数据库行转换为 ConversationTag */
function rowToConversationTag(row: Record<string, unknown>): ConversationTag {
  return {
    id: row.id as string,
    name: row.name as string,
    color: row.color as string,
    createdAt: row.created_at as number,
  };
}

/** 将数据库行转换为 ConfigTag */
function rowToConfigTag(row: Record<string, unknown>): ConfigTag {
  return {
    id: row.id as string,
    name: row.name as string,
    color: row.color as string,
    createdAt: row.created_at as number,
  };
}

class TagManager {
  private generateId = generateId;

  // ==================== 对话标签 ====================

  /** 获取所有对话标签 */
  async getConversationTags(): Promise<ConversationTag[]> {
    const db = await getDb();
    const stmt = db.prepare('SELECT * FROM conversation_tags ORDER BY created_at DESC');
    const tags: ConversationTag[] = [];
    try {
      while (stmt.step()) {
        tags.push(rowToConversationTag(stmt.getAsObject() as Record<string, unknown>));
      }
    } finally {
      stmt.free();
    }
    return tags;
  }

  /** 创建对话标签 */
  async createConversationTag(data: { name: string; color: string }): Promise<ConversationTag> {
    const db = await getDb();
    const id = this.generateId();
    const now = Date.now();

    db.run(
      'INSERT INTO conversation_tags (id, name, color, created_at) VALUES (?, ?, ?, ?)',
      [id, data.name, data.color, now],
    );
    requestSave();

    return { id, name: data.name, color: data.color, createdAt: now };
  }

  /** 更新对话标签 */
  async updateConversationTag(id: string, data: { name?: string; color?: string }): Promise<ConversationTag> {
    const db = await getDb();
    const existing = db.exec('SELECT * FROM conversation_tags WHERE id = ?', [id]);
    if (existing.length === 0 || existing[0].values.length === 0) {
      throw new Error('Tag not found');
    }

    const row = existing[0].values[0];
    const current = {
      id: row[0] as string,
      name: row[1] as string,
      color: row[2] as string,
      createdAt: row[3] as number,
    };

    const updated = {
      ...current,
      name: data.name ?? current.name,
      color: data.color ?? current.color,
    };

    db.run(
      'UPDATE conversation_tags SET name = ?, color = ? WHERE id = ?',
      [updated.name, updated.color, id],
    );
    requestSave();

    return updated;
  }

  /** 删除对话标签 */
  async deleteConversationTag(id: string): Promise<void> {
    const db = await getDb();
    withTransaction(db, () => {
      db.run('DELETE FROM conversation_tag_relations WHERE tag_id = ?', [id]);
      db.run('DELETE FROM conversation_tags WHERE id = ?', [id]);
    });
  }

  /** 设置对话标签（替换） */
  async setConversationTags(conversationId: string, tagIds: string[]): Promise<void> {
    const db = await getDb();
    withTransaction(db, () => {
      db.run('DELETE FROM conversation_tag_relations WHERE conversation_id = ?', [conversationId]);
      for (const tagId of tagIds) {
        db.run(
          'INSERT INTO conversation_tag_relations (conversation_id, tag_id) VALUES (?, ?)',
          [conversationId, tagId],
        );
      }
    });
  }

  /** 批量获取多个对话的标签 */
  async getConversationTagsBatch(conversationIds: string[]): Promise<Record<string, ConversationTag[]>> {
    const db = await getDb();
    const result: Record<string, ConversationTag[]> = {};
    if (conversationIds.length === 0) return result;
    conversationIds.forEach(id => { result[id] = []; });
    const placeholders = conversationIds.map(() => '?').join(',');
    const stmt = db.prepare(`
      SELECT r.conversation_id, t.* FROM conversation_tags t
      INNER JOIN conversation_tag_relations r ON t.id = r.tag_id
      WHERE r.conversation_id IN (${placeholders})
      ORDER BY t.created_at DESC
    `);
    try {
      stmt.bind(conversationIds);
      while (stmt.step()) {
        const row = stmt.getAsObject() as Record<string, unknown>;
        const convId = row.conversation_id as string;
        result[convId].push(rowToConversationTag(row));
      }
    } finally {
      stmt.free();
    }
    return result;
  }

  /** 获取对话的标签 */
  async getConversationTagsByIds(conversationId: string): Promise<ConversationTag[]> {
    const db = await getDb();
    const stmt = db.prepare(`
      SELECT t.* FROM conversation_tags t
      INNER JOIN conversation_tag_relations r ON t.id = r.tag_id
      WHERE r.conversation_id = ?
      ORDER BY t.created_at DESC
    `);
    const tags: ConversationTag[] = [];
    try {
      stmt.bind([conversationId]);
      while (stmt.step()) {
        tags.push(rowToConversationTag(stmt.getAsObject() as Record<string, unknown>));
      }
    } finally {
      stmt.free();
    }
    return tags;
  }

  /** 按标签获取对话 */
  async getConversationsByTag(tagId: string): Promise<Conversation[]> {
    const db = await getDb();
    const stmt = db.prepare(`
      SELECT c.* FROM conversations c
      INNER JOIN conversation_tag_relations r ON c.id = r.conversation_id
      WHERE r.tag_id = ?
      ORDER BY c.updated_at DESC
    `);
    const conversations: Conversation[] = [];
    try {
      stmt.bind([tagId]);
      while (stmt.step()) {
        const row = stmt.getAsObject() as Record<string, unknown>;
        conversations.push({
          id: row.id as string,
          title: row.title as string,
          chartType: row.chart_type as string,
          format: ((row.format as string) || 'excalidraw') as DiagramFormat,
          configName: (row.config_name as string) || undefined,
          configModel: (row.config_model as string) || undefined,
          currentCode: row.current_code as string,
          messageCount: row.message_count as number,
          createdAt: row.created_at as number,
          updatedAt: row.updated_at as number,
        });
      }
    } finally {
      stmt.free();
    }
    return conversations;
  }

  // ==================== 配置标签 ====================

  /** 获取所有配置标签 */
  async getConfigTags(): Promise<ConfigTag[]> {
    const db = await getDb();
    const stmt = db.prepare('SELECT * FROM config_tags ORDER BY created_at DESC');
    const tags: ConfigTag[] = [];
    try {
      while (stmt.step()) {
        tags.push(rowToConfigTag(stmt.getAsObject() as Record<string, unknown>));
      }
    } finally {
      stmt.free();
    }
    return tags;
  }

  /** 创建配置标签 */
  async createConfigTag(data: { name: string; color: string }): Promise<ConfigTag> {
    const db = await getDb();
    const id = this.generateId();
    const now = Date.now();

    db.run(
      'INSERT INTO config_tags (id, name, color, created_at) VALUES (?, ?, ?, ?)',
      [id, data.name, data.color, now],
    );
    requestSave();

    return { id, name: data.name, color: data.color, createdAt: now };
  }

  /** 更新配置标签 */
  async updateConfigTag(id: string, data: { name?: string; color?: string }): Promise<ConfigTag> {
    const db = await getDb();
    const existing = db.exec('SELECT * FROM config_tags WHERE id = ?', [id]);
    if (existing.length === 0 || existing[0].values.length === 0) {
      throw new Error('Tag not found');
    }

    const row = existing[0].values[0];
    const current = {
      id: row[0] as string,
      name: row[1] as string,
      color: row[2] as string,
      createdAt: row[3] as number,
    };

    const updated = {
      ...current,
      name: data.name ?? current.name,
      color: data.color ?? current.color,
    };

    db.run(
      'UPDATE config_tags SET name = ?, color = ? WHERE id = ?',
      [updated.name, updated.color, id],
    );
    requestSave();

    return updated;
  }

  /** 删除配置标签 */
  async deleteConfigTag(id: string): Promise<void> {
    const db = await getDb();
    withTransaction(db, () => {
      db.run('DELETE FROM config_tag_relations WHERE tag_id = ?', [id]);
      db.run('DELETE FROM config_tags WHERE id = ?', [id]);
    });
  }

  /** 设置配置标签（替换） */
  async setConfigTags(configId: string, tagIds: string[]): Promise<void> {
    const db = await getDb();
    withTransaction(db, () => {
      db.run('DELETE FROM config_tag_relations WHERE config_id = ?', [configId]);
      for (const tagId of tagIds) {
        db.run(
          'INSERT INTO config_tag_relations (config_id, tag_id) VALUES (?, ?)',
          [configId, tagId],
        );
      }
    });
  }

  /** 批量获取多个配置的标签 */
  async getConfigTagsBatch(configIds: string[]): Promise<Record<string, ConfigTag[]>> {
    const db = await getDb();
    const result: Record<string, ConfigTag[]> = {};
    if (configIds.length === 0) return result;
    configIds.forEach(id => { result[id] = []; });
    const placeholders = configIds.map(() => '?').join(',');
    const stmt = db.prepare(`
      SELECT r.config_id, t.* FROM config_tags t
      INNER JOIN config_tag_relations r ON t.id = r.tag_id
      WHERE r.config_id IN (${placeholders})
      ORDER BY t.created_at DESC
    `);
    try {
      stmt.bind(configIds);
      while (stmt.step()) {
        const row = stmt.getAsObject() as Record<string, unknown>;
        const cfgId = row.config_id as string;
        result[cfgId].push(rowToConfigTag(row));
      }
    } finally {
      stmt.free();
    }
    return result;
  }

  /** 获取配置的标签 */
  async getConfigTagsByIds(configId: string): Promise<ConfigTag[]> {
    const db = await getDb();
    const stmt = db.prepare(`
      SELECT t.* FROM config_tags t
      INNER JOIN config_tag_relations r ON t.id = r.tag_id
      WHERE r.config_id = ?
      ORDER BY t.created_at DESC
    `);
    const tags: ConfigTag[] = [];
    try {
      stmt.bind([configId]);
      while (stmt.step()) {
        tags.push(rowToConfigTag(stmt.getAsObject() as Record<string, unknown>));
      }
    } finally {
      stmt.free();
    }
    return tags;
  }

  /** 按标签获取配置 */
  async getConfigsByTag(tagId: string): Promise<LLMConfig[]> {
    const db = await getDb();
    const stmt = db.prepare(`
      SELECT c.* FROM llm_configs c
      INNER JOIN config_tag_relations r ON c.id = r.config_id
      WHERE r.tag_id = ?
      ORDER BY c.created_at DESC
    `);
    const configs: LLMConfig[] = [];
    try {
      stmt.bind([tagId]);
      while (stmt.step()) {
        const row = stmt.getAsObject() as Record<string, unknown>;
        const rawApiKey = row.api_key as string;
        configs.push({
          id: row.id as string,
          name: row.name as string,
          type: row.type as 'openai' | 'anthropic' | 'ollama',
          baseUrl: row.base_url as string,
          apiKey: rawApiKey && isEncrypted(rawApiKey) ? decrypt(rawApiKey) : rawApiKey,
          model: row.model as string,
          description: row.description as string,
          isActive: (row.is_active as number) === 1,
          temperature: (row.temperature as number) ?? 0.5,
          maxTokens: row.max_tokens as number,
          createdAt: row.created_at as number,
          updatedAt: row.updated_at as number,
        });
      }
    } finally {
      stmt.free();
    }
    return configs;
  }
}

export const tagManager = new TagManager();
export default TagManager;

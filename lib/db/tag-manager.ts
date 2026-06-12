import { getDb, requestSave } from './index';
import { withTransaction } from './transaction';
import { generateId } from '@/lib/utils';
import { isEncrypted, decrypt } from './crypto';
import type { ConversationTag, ConfigTag, Conversation, LLMConfig } from '@/lib/types';
import type { DiagramFormat } from '@/lib/types/diagram-strategy';

/** 通用标签接口 */
interface BaseTag {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

/** 将数据库行转换为标签对象（通用） */
function rowToTag<T extends BaseTag>(row: Record<string, unknown>): T {
  return {
    id: row.id as string,
    name: row.name as string,
    color: row.color as string,
    createdAt: row.created_at as number,
  } as T;
}

/** 通用标签 CRUD 操作工厂 */
function createTagCRUD<T extends BaseTag>(tableName: string) {
  return {
    async getAll(): Promise<T[]> {
      const db = await getDb();
      const stmt = db.prepare(`SELECT * FROM ${tableName} ORDER BY created_at DESC`);
      const tags: T[] = [];
      try {
        while (stmt.step()) {
          tags.push(rowToTag<T>(stmt.getAsObject() as Record<string, unknown>));
        }
      } finally {
        stmt.free();
      }
      return tags;
    },

    async create(data: { name: string; color: string }): Promise<T> {
      const db = await getDb();
      const id = generateId();
      const now = Date.now();

      db.run(
        `INSERT INTO ${tableName} (id, name, color, created_at) VALUES (?, ?, ?, ?)`,
        [id, data.name, data.color, now],
      );
      requestSave();

      return { id, name: data.name, color: data.color, createdAt: now } as T;
    },

    async update(id: string, data: { name?: string; color?: string }): Promise<T> {
      const db = await getDb();
      const existing = db.exec(`SELECT * FROM ${tableName} WHERE id = ?`, [id]);
      if (existing.length === 0 || existing[0].values.length === 0) {
        throw new Error('标签不存在');
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
        `UPDATE ${tableName} SET name = ?, color = ? WHERE id = ?`,
        [updated.name, updated.color, id],
      );
      requestSave();

      return updated as T;
    },

    async delete(id: string, relationTable: string, relationColumn: string): Promise<void> {
      const db = await getDb();
      withTransaction(db, () => {
        db.run(`DELETE FROM ${relationTable} WHERE ${relationColumn} = ?`, [id]);
        db.run(`DELETE FROM ${tableName} WHERE id = ?`, [id]);
      });
    },
  };
}

class TagManager {
  private conversationTagCRUD = createTagCRUD<ConversationTag>('conversation_tags');
  private configTagCRUD = createTagCRUD<ConfigTag>('config_tags');

  // ==================== 对话标签 ====================

  /** 获取所有对话标签 */
  async getConversationTags(): Promise<ConversationTag[]> {
    return this.conversationTagCRUD.getAll();
  }

  /** 创建对话标签 */
  async createConversationTag(data: { name: string; color: string }): Promise<ConversationTag> {
    return this.conversationTagCRUD.create(data);
  }

  /** 更新对话标签 */
  async updateConversationTag(id: string, data: { name?: string; color?: string }): Promise<ConversationTag> {
    return this.conversationTagCRUD.update(id, data);
  }

  /** 删除对话标签 */
  async deleteConversationTag(id: string): Promise<void> {
    return this.conversationTagCRUD.delete(id, 'conversation_tag_relations', 'tag_id');
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
    return this.configTagCRUD.getAll();
  }

  /** 创建配置标签 */
  async createConfigTag(data: { name: string; color: string }): Promise<ConfigTag> {
    return this.configTagCRUD.create(data);
  }

  /** 更新配置标签 */
  async updateConfigTag(id: string, data: { name?: string; color?: string }): Promise<ConfigTag> {
    return this.configTagCRUD.update(id, data);
  }

  /** 删除配置标签 */
  async deleteConfigTag(id: string): Promise<void> {
    return this.configTagCRUD.delete(id, 'config_tag_relations', 'tag_id');
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

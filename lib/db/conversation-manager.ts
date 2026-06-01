import { getDb, saveToDisk } from './index';
import { generateId, parseStoredImages } from '@/lib/utils';
import type { Conversation, ConversationMessage, ConversationWithMessages, LLMMessage } from '@/types';
import type { DiagramFormat } from '@/types/diagram-strategy';

interface ConversationRow {
  id: string;
  title: string;
  chart_type: string;
  format: string;
  config_name: string | null;
  config_model: string | null;
  current_code: string;
  message_count: number;
  created_at: number;
  updated_at: number;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  image_data: string | null;
  image_mime_type: string | null;
  source_type: string | null;
  created_at: number;
}

function rowToConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    title: row.title,
    chartType: row.chart_type,
    format: (row.format as DiagramFormat) || 'excalidraw',
    configName: row.config_name || undefined,
    configModel: row.config_model || undefined,
    currentCode: row.current_code,
    messageCount: row.message_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** 将数据库行数组解析为 Conversation 对象 */
function parseConversationRow(row: unknown[]): Conversation {
  return rowToConversation({
    id: row[0] as string,
    title: row[1] as string,
    chart_type: row[2] as string,
    format: row[3] as string,
    config_name: row[4] as string | null,
    config_model: row[5] as string | null,
    current_code: row[6] as string,
    message_count: row[7] as number,
    created_at: row[8] as number,
    updated_at: row[9] as number,
  });
}

function rowToMessage(row: MessageRow): ConversationMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role as 'user' | 'assistant',
    content: row.content,
    imageData: row.image_data || undefined,
    imageMimeType: row.image_mime_type || undefined,
    sourceType: (row.source_type as 'text' | 'file' | 'image') || 'text',
    createdAt: row.created_at,
  };
}

function toLLMMessage(msg: ConversationMessage): LLMMessage {
  const llmMsg: LLMMessage = {
    role: msg.role,
    content: msg.content,
  };
  const images = parseStoredImages(msg.imageData, msg.imageMimeType);
  if (images.length > 0) {
    llmMsg.images = images;
  }
  return llmMsg;
}

const MAX_CONTEXT_MESSAGES = 20;

class ConversationManager {
  private generateId = generateId;

  async create(data: {
    title?: string;
    chartType: string;
    format: DiagramFormat;
    configName?: string;
    configModel?: string;
  }): Promise<Conversation> {
    const db = await getDb();
    const id = this.generateId();
    const now = Date.now();
    const title = data.title || 'New Conversation';

    db.run(
      `INSERT INTO conversations (id, title, chart_type, format, config_name, config_model, current_code, message_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, '', 0, ?, ?)`,
      [id, title, data.chartType, data.format, data.configName || null, data.configModel || null, now, now],
    );
    saveToDisk();

    return {
      id,
      title,
      chartType: data.chartType,
      format: data.format,
      configName: data.configName,
      configModel: data.configModel,
      currentCode: '',
      messageCount: 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  async getAll(limit?: number): Promise<Conversation[]> {
    const db = await getDb();
    const sql = limit
      ? 'SELECT * FROM conversations ORDER BY updated_at DESC LIMIT ?'
      : 'SELECT * FROM conversations ORDER BY updated_at DESC';
    const result = limit ? db.exec(sql, [limit]) : db.exec(sql);
    if (result.length === 0) return [];
    return result[0].values.map((row: unknown[]) => parseConversationRow(row));
  }

  async getById(id: string): Promise<ConversationWithMessages | null> {
    const db = await getDb();
    const convResult = db.exec('SELECT * FROM conversations WHERE id = ?', [id]);
    if (convResult.length === 0 || convResult[0].values.length === 0) return null;

    const row = convResult[0].values[0];
    const conversation = parseConversationRow(row);

    const messages = await this.getMessages(id);
    return { ...conversation, messages };
  }

  async update(id: string, data: Partial<{
    title: string;
    chartType: string;
    format: DiagramFormat;
    currentCode: string;
    configName: string;
    configModel: string;
  }>): Promise<Conversation | null> {
    const db = await getDb();
    const existing = db.exec('SELECT * FROM conversations WHERE id = ?', [id]);
    if (existing.length === 0 || existing[0].values.length === 0) return null;

    const now = Date.now();
    const sets: string[] = ['updated_at = ?'];
    const params: unknown[] = [now];

    if (data.title !== undefined) { sets.push('title = ?'); params.push(data.title); }
    if (data.chartType !== undefined) { sets.push('chart_type = ?'); params.push(data.chartType); }
    if (data.format !== undefined) { sets.push('format = ?'); params.push(data.format); }
    if (data.currentCode !== undefined) { sets.push('current_code = ?'); params.push(data.currentCode); }
    if (data.configName !== undefined) { sets.push('config_name = ?'); params.push(data.configName); }
    if (data.configModel !== undefined) { sets.push('config_model = ?'); params.push(data.configModel); }

    params.push(id);
    db.run(`UPDATE conversations SET ${sets.join(', ')} WHERE id = ?`, params);
    saveToDisk();

    const result = db.exec('SELECT * FROM conversations WHERE id = ?', [id]);
    if (result.length === 0 || result[0].values.length === 0) return null;
    const row = result[0].values[0];
    return parseConversationRow(row);
  }

  async delete(id: string): Promise<void> {
    const db = await getDb();
    db.run('DELETE FROM messages WHERE conversation_id = ?', [id]);
    db.run('DELETE FROM conversations WHERE id = ?', [id]);
    saveToDisk();
  }

  async clearAll(): Promise<void> {
    const db = await getDb();
    db.run('DELETE FROM messages');
    db.run('DELETE FROM conversations');
    saveToDisk();
  }

  async addMessage(data: {
    conversationId: string;
    role: 'user' | 'assistant';
    content: string;
    imageData?: string;
    imageMimeType?: string;
    sourceType?: string;
  }): Promise<ConversationMessage> {
    const db = await getDb();
    const id = this.generateId();
    const now = Date.now();

    db.run(
      `INSERT INTO messages (id, conversation_id, role, content, image_data, image_mime_type, source_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.conversationId, data.role, data.content, data.imageData || null, data.imageMimeType || null, data.sourceType || 'text', now],
    );

    db.run(
      'UPDATE conversations SET message_count = message_count + 1, updated_at = ? WHERE id = ?',
      [now, data.conversationId],
    );
    saveToDisk();

    return {
      id,
      conversationId: data.conversationId,
      role: data.role,
      content: data.content,
      imageData: data.imageData,
      imageMimeType: data.imageMimeType,
      sourceType: (data.sourceType as 'text' | 'file' | 'image') || 'text',
      createdAt: now,
    };
  }

  async getMessages(conversationId: string, limit?: number, offset?: number): Promise<ConversationMessage[]> {
    const db = await getDb();
    let sql = 'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC';
    const params: unknown[] = [conversationId];
    if (limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(limit);
      if (offset !== undefined) {
        sql += ' OFFSET ?';
        params.push(offset);
      }
    }
    const result = db.exec(sql, params);
    if (result.length === 0) return [];
    return result[0].values.map((row: unknown[]) =>
      rowToMessage({
        id: row[0] as string,
        conversation_id: row[1] as string,
        role: row[2] as string,
        content: row[3] as string,
        image_data: row[4] as string | null,
        image_mime_type: row[5] as string | null,
        source_type: row[6] as string | null,
        created_at: row[7] as number,
      }),
    );
  }

  async buildContextMessages(conversationId: string, maxMessages: number = MAX_CONTEXT_MESSAGES): Promise<LLMMessage[]> {
    const messages = await this.getMessages(conversationId);

    if (messages.length <= maxMessages) {
      return messages.map(toLLMMessage);
    }

    const firstUserIdx = messages.findIndex(m => m.role === 'user');
    const firstMessage = firstUserIdx >= 0 ? messages[firstUserIdx] : messages[0];
    const recentMessages = messages.slice(-(maxMessages - 1));

    const contextMessages: ConversationMessage[] = [firstMessage];

    if (firstMessage.id !== recentMessages[0].id) {
      contextMessages.push({
        id: 'truncation-notice',
        conversationId,
        role: 'assistant',
        content: '[System: Earlier messages have been truncated for context window management.]',
        createdAt: firstMessage.createdAt + 1,
      });
    }

    for (const msg of recentMessages) {
      if (msg.id !== firstMessage.id) {
        contextMessages.push(msg);
      }
    }

    return contextMessages.map(toLLMMessage);
  }

  async deleteLastAssistantMessage(conversationId: string): Promise<void> {
    const db = await getDb();
    // 找到最后一条 assistant 消息的 id
    const result = db.exec(
      'SELECT id FROM messages WHERE conversation_id = ? AND role = ? ORDER BY created_at DESC LIMIT 1',
      [conversationId, 'assistant'],
    );
    if (result.length === 0 || result[0].values.length === 0) return;
    const msgId = result[0].values[0][0] as string;
    db.run('DELETE FROM messages WHERE id = ?', [msgId]);
    db.run(
      'UPDATE conversations SET message_count = MAX(message_count - 1, 0), updated_at = ? WHERE id = ?',
      [Date.now(), conversationId],
    );
    saveToDisk();
  }

  async updateCurrentCode(conversationId: string, code: string): Promise<void> {
    const db = await getDb();
    const now = Date.now();
    db.run('UPDATE conversations SET current_code = ?, updated_at = ? WHERE id = ?', [code, now, conversationId]);
    saveToDisk();
  }

  async updateTitle(conversationId: string, title: string): Promise<void> {
    const db = await getDb();
    db.run('UPDATE conversations SET title = ? WHERE id = ?', [title, conversationId]);
    saveToDisk();
  }

  /** 搜索会话，支持标题模糊搜索、排序和分页 */
  async search(params: {
    query?: string;
    sort?: string;
    order?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    conversations: Conversation[];
    total: number;
  }> {
    const db = await getDb();
    const { query, sort = 'updated_at', order = 'desc', limit = 20, offset = 0 } = params;

    // 构建 WHERE 子句
    const whereClauses: string[] = [];
    const queryParams: unknown[] = [];

    if (query && query.trim()) {
      whereClauses.push('LOWER(title) LIKE ?');
      queryParams.push(`%${query.toLowerCase()}%`);
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // 验证排序字段，防止 SQL 注入
    const validSortFields = ['updated_at', 'created_at'];
    const validOrders = ['asc', 'desc'];
    const sortField = validSortFields.includes(sort) ? sort : 'updated_at';
    const sortOrder = validOrders.includes(order) ? order : 'desc';

    // 获取总数
    const countSql = `SELECT COUNT(*) as total FROM conversations ${whereStr}`;
    const countResult = db.exec(countSql, queryParams);
    const total = countResult.length > 0 ? (countResult[0].values[0][0] as number) : 0;

    // 获取分页数据
    const dataSql = `SELECT * FROM conversations ${whereStr} ORDER BY ${sortField} ${sortOrder} LIMIT ? OFFSET ?`;
    const dataParams = [...queryParams, limit, offset];
    const result = db.exec(dataSql, dataParams);

    const conversations = result.length > 0
      ? result[0].values.map((row: unknown[]) => parseConversationRow(row))
      : [];

    return { conversations, total };
  }

  /** 获取会话总数，用于数量限制检查 */
  async getCount(): Promise<number> {
    const db = await getDb();
    const result = db.exec('SELECT COUNT(*) as count FROM conversations');
    return result.length > 0 ? (result[0].values[0][0] as number) : 0;
  }
}

export const conversationManager = new ConversationManager();

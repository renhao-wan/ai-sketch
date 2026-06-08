import { getDb, requestSave } from './index';
import { withTransaction } from './transaction';
import { generateId, parseStoredImages } from '@/lib/utils';
import type { Conversation, ConversationMessage, ConversationWithMessages, LLMMessage } from '@/lib/types';
import type { DiagramFormat } from '@/lib/types/diagram-strategy';

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

/** 将数据库行对象解析为 Conversation 对象 */
function parseConversationRow(row: Record<string, unknown>): Conversation {
  return rowToConversation({
    id: row.id as string,
    title: row.title as string,
    chart_type: row.chart_type as string,
    format: row.format as string,
    config_name: row.config_name as string | null,
    config_model: row.config_model as string | null,
    current_code: row.current_code as string,
    message_count: row.message_count as number,
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
  });
}

function rowToMessage(row: Record<string, unknown>): ConversationMessage {
  return {
    id: row.id as string,
    conversationId: row.conversation_id as string,
    role: row.role as 'user' | 'assistant',
    content: row.content as string,
    imageData: (row.image_data as string) || undefined,
    imageMimeType: (row.image_mime_type as string) || undefined,
    sourceType: (row.source_type as 'text' | 'file' | 'image') || 'text',
    createdAt: row.created_at as number,
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
    requestSave();

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
    const stmt = db.prepare(sql);
    if (limit !== undefined) stmt.bind([limit]);
    const conversations: Conversation[] = [];
    try {
      while (stmt.step()) {
        conversations.push(parseConversationRow(stmt.getAsObject() as Record<string, unknown>));
      }
    } finally {
      stmt.free();
    }
    return conversations;
  }

  async getById(id: string): Promise<ConversationWithMessages | null> {
    const db = await getDb();
    const stmt = db.prepare('SELECT * FROM conversations WHERE id = ?');
    try {
      stmt.bind([id]);
      if (!stmt.step()) {
        return null;
      }
      const conversation = parseConversationRow(stmt.getAsObject() as Record<string, unknown>);
      const messages = await this.getMessages(id);
      return { ...conversation, messages };
    } finally {
      stmt.free();
    }
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
    // 检查是否存在并获取完整行数据
    const stmt = db.prepare('SELECT * FROM conversations WHERE id = ?');
    let existing: Record<string, unknown>;
    try {
      stmt.bind([id]);
      if (!stmt.step()) {
        return null;
      }
      existing = stmt.getAsObject() as Record<string, unknown>;
    } finally {
      stmt.free();
    }

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
    requestSave();

    // 直接构造返回对象，无需再次 SELECT
    return {
      id,
      title: data.title ?? (existing.title as string),
      chartType: data.chartType ?? (existing.chart_type as string),
      format: (data.format ?? (existing.format as string) ?? 'excalidraw') as DiagramFormat,
      configName: data.configName ?? (existing.config_name as string | null) ?? undefined,
      configModel: data.configModel ?? (existing.config_model as string | null) ?? undefined,
      currentCode: data.currentCode ?? (existing.current_code as string),
      messageCount: existing.message_count as number,
      createdAt: existing.created_at as number,
      updatedAt: now,
    };
  }

  async delete(id: string): Promise<void> {
    const db = await getDb();
    withTransaction(db, () => {
      db.run('DELETE FROM messages WHERE conversation_id = ?', [id]);
      db.run('DELETE FROM conversations WHERE id = ?', [id]);
    });
  }

  async deleteMany(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const db = await getDb();
    const placeholders = ids.map(() => '?').join(',');
    withTransaction(db, () => {
      db.run(`DELETE FROM messages WHERE conversation_id IN (${placeholders})`, ids);
      db.run(`DELETE FROM conversations WHERE id IN (${placeholders})`, ids);
    });
  }

  async clearAll(): Promise<void> {
    const db = await getDb();
    withTransaction(db, () => {
      db.run('DELETE FROM messages');
      db.run('DELETE FROM conversations');
    });
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

    withTransaction(db, () => {
      db.run(
        `INSERT INTO messages (id, conversation_id, role, content, image_data, image_mime_type, source_type, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, data.conversationId, data.role, data.content, data.imageData || null, data.imageMimeType || null, data.sourceType || 'text', now],
      );

      db.run(
        'UPDATE conversations SET message_count = message_count + 1, updated_at = ? WHERE id = ?',
        [now, data.conversationId],
      );
    });

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
    const stmt = db.prepare(sql);
    const messages: ConversationMessage[] = [];
    try {
      stmt.bind(params);
      while (stmt.step()) {
        messages.push(rowToMessage(stmt.getAsObject() as Record<string, unknown>));
      }
    } finally {
      stmt.free();
    }
    return messages;
  }

  async buildContextMessages(conversationId: string, maxMessages: number = MAX_CONTEXT_MESSAGES): Promise<LLMMessage[]> {
    const db = await getDb();

    // 先查总数，避免全量加载
    const countResult = db.exec('SELECT COUNT(*) FROM messages WHERE conversation_id = ?', [conversationId]);
    const totalCount = countResult.length > 0 ? (countResult[0].values[0][0] as number) : 0;

    if (totalCount <= maxMessages) {
      // 消息数未超限，全量返回
      const messages = await this.getMessages(conversationId);
      return messages.map(toLLMMessage);
    }

    // 获取第一条 user �消息
    let firstMessage: ConversationMessage | null = null;
    const firstUserStmt = db.prepare(
      'SELECT * FROM messages WHERE conversation_id = ? AND role = ? ORDER BY created_at ASC LIMIT 1',
    );
    try {
      firstUserStmt.bind([conversationId, 'user']);
      if (firstUserStmt.step()) {
        firstMessage = rowToMessage(firstUserStmt.getAsObject() as Record<string, unknown>);
      }
    } finally {
      firstUserStmt.free();
    }

    // 如果没有 user 消息，获取第一条消息
    if (!firstMessage) {
      const firstStmt = db.prepare(
        'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 1',
      );
      try {
        firstStmt.bind([conversationId]);
        if (firstStmt.step()) {
          firstMessage = rowToMessage(firstStmt.getAsObject() as Record<string, unknown>);
        }
      } finally {
        firstStmt.free();
      }
    }

    if (!firstMessage) return [];

    // 获取最近 N-1 条消息（倒序查询后反转）
    const recentStmt = db.prepare(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?',
    );
    const recentMessages: ConversationMessage[] = [];
    try {
      recentStmt.bind([conversationId, maxMessages - 1]);
      while (recentStmt.step()) {
        recentMessages.push(rowToMessage(recentStmt.getAsObject() as Record<string, unknown>));
      }
    } finally {
      recentStmt.free();
    }
    recentMessages.reverse();

    const contextMessages: ConversationMessage[] = [firstMessage];

    if (recentMessages.length > 0 && firstMessage.id !== recentMessages[0].id) {
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

    withTransaction(db, () => {
      db.run('DELETE FROM messages WHERE id = ?', [msgId]);
      db.run(
        'UPDATE conversations SET message_count = MAX(message_count - 1, 0), updated_at = ? WHERE id = ?',
        [Date.now(), conversationId],
      );
    });
  }

  /** 删除最后一条消息（任意角色），用于生成失败时清理 */
  async deleteLastMessage(conversationId: string): Promise<void> {
    const db = await getDb();
    const result = db.exec(
      'SELECT id FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1',
      [conversationId],
    );
    if (result.length === 0 || result[0].values.length === 0) return;
    const msgId = result[0].values[0][0] as string;

    withTransaction(db, () => {
      db.run('DELETE FROM messages WHERE id = ?', [msgId]);
      db.run(
        'UPDATE conversations SET message_count = MAX(message_count - 1, 0), updated_at = ? WHERE id = ?',
        [Date.now(), conversationId],
      );
    });
  }

  async updateCurrentCode(conversationId: string, code: string): Promise<void> {
    const db = await getDb();
    const now = Date.now();
    db.run('UPDATE conversations SET current_code = ?, updated_at = ? WHERE id = ?', [code, now, conversationId]);
    requestSave();
  }

  async updateTitle(conversationId: string, title: string): Promise<void> {
    const db = await getDb();
    db.run('UPDATE conversations SET title = ? WHERE id = ?', [title, conversationId]);
    requestSave();
  }

  /** 搜索会话，支持标题模糊搜索、排序和分页 */
  async search(params: {
    query?: string;
    sort?: string;
    order?: string;
    limit?: number;
    offset?: number;
    tagId?: string;
  }): Promise<{
    conversations: Conversation[];
    total: number;
  }> {
    const db = await getDb();
    const { query, sort = 'updated_at', order = 'desc', limit = 20, offset = 0, tagId } = params;

    // 构建 WHERE 子句
    const whereClauses: string[] = [];
    const queryParams: unknown[] = [];

    if (query && query.trim()) {
      whereClauses.push('LOWER(c.title) LIKE ?');
      queryParams.push(`%${query.toLowerCase()}%`);
    }

    // 标签筛选：通过 JOIN conversation_tag_relations 实现
    let joinClause = '';
    if (tagId) {
      joinClause = 'INNER JOIN conversation_tag_relations r ON c.id = r.conversation_id AND r.tag_id = ?';
      queryParams.unshift(tagId); // 将 tagId 放在参数最前面
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // 验证排序字段，防止 SQL 注入
    const validSortFields = ['updated_at', 'created_at'];
    const validOrders = ['asc', 'desc'];
    const sortField = validSortFields.includes(sort) ? sort : 'updated_at';
    const sortOrder = validOrders.includes(order) ? order : 'desc';

    // 获取总数
    const countSql = `SELECT COUNT(*) as total FROM conversations c ${joinClause} ${whereStr}`;
    const countResult = db.exec(countSql, queryParams);
    const total = countResult.length > 0 ? (countResult[0].values[0][0] as number) : 0;

    // 获取分页数据
    const dataSql = `SELECT c.* FROM conversations c ${joinClause} ${whereStr} ORDER BY c.${sortField} ${sortOrder} LIMIT ? OFFSET ?`;
    const dataParams = [...queryParams, limit, offset];
    const stmt = db.prepare(dataSql);
    const conversations: Conversation[] = [];
    try {
      stmt.bind(dataParams);
      while (stmt.step()) {
        conversations.push(parseConversationRow(stmt.getAsObject() as Record<string, unknown>));
      }
    } finally {
      stmt.free();
    }

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

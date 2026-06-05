import { getDb, requestSave } from './index';
import { generateId } from '@/lib/utils';
import type { DiagramFormat } from '@/lib/types/diagram-strategy';

interface CacheEntry {
  id: string;
  promptHash: string;
  format: DiagramFormat;
  chartType: string;
  response: string;
  createdAt: number;
  lastUsedAt: number;
  useCount: number;
}

/** 将数据库行对象解析为 CacheEntry */
function rowToCacheEntry(row: Record<string, unknown>): CacheEntry {
  return {
    id: row.id as string,
    promptHash: row.prompt_hash as string,
    format: row.format as DiagramFormat,
    chartType: row.chart_type as string,
    response: row.response as string,
    createdAt: row.created_at as number,
    lastUsedAt: row.last_used_at as number,
    useCount: row.use_count as number,
  };
}

/** 计算字符串的 SHA-256 哈希值 */
async function hashPrompt(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

/** 缓存管理器 */
class CacheManager {
  /** 缓存 TTL（毫秒），默认 7 天 */
  private readonly TTL = 7 * 24 * 60 * 60 * 1000;

  /** 最大缓存条目数 */
  private readonly MAX_ENTRIES = 1000;

  /** 获取缓存 */
  async get(prompt: string, format: DiagramFormat, chartType: string): Promise<string | null> {
    const db = await getDb();
    const promptHash = await hashPrompt(prompt);

    const stmt = db.prepare(
      'SELECT * FROM response_cache WHERE prompt_hash = ? AND format = ? AND chart_type = ?',
    );
    stmt.bind([promptHash, format, chartType]);

    let entry: CacheEntry | null = null;
    if (stmt.step()) {
      entry = rowToCacheEntry(stmt.getAsObject() as Record<string, unknown>);
    }
    stmt.free();

    if (!entry) return null;

    // 检查是否过期
    const now = Date.now();
    if (now - entry.createdAt > this.TTL) {
      // 过期，删除并返回 null
      await this.delete(entry.id);
      return null;
    }

    // 更新使用时间和次数
    db.run(
      'UPDATE response_cache SET last_used_at = ?, use_count = use_count + 1 WHERE id = ?',
      [now, entry.id],
    );
    requestSave();

    return entry.response;
  }

  /** 设置缓存 */
  async set(prompt: string, format: DiagramFormat, chartType: string, response: string): Promise<void> {
    const db = await getDb();
    const promptHash = await hashPrompt(prompt);
    const now = Date.now();
    const id = generateId();

    // 检查是否已存在
    const existingStmt = db.prepare(
      'SELECT id FROM response_cache WHERE prompt_hash = ? AND format = ? AND chart_type = ?',
    );
    existingStmt.bind([promptHash, format, chartType]);
    const exists = existingStmt.step();
    existingStmt.free();

    if (exists) {
      // 已存在，更新
      db.run(
        'UPDATE response_cache SET response = ?, last_used_at = ?, use_count = use_count + 1 WHERE prompt_hash = ? AND format = ? AND chart_type = ?',
        [response, now, promptHash, format, chartType],
      );
    } else {
      // 不存在，插入
      db.run(
        'INSERT INTO response_cache (id, prompt_hash, format, chart_type, response, created_at, last_used_at, use_count) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
        [id, promptHash, format, chartType, response, now, now],
      );
    }

    requestSave();

    // 清理过期和多余的缓存
    await this.cleanup();
  }

  /** 删除缓存条目 */
  private async delete(id: string): Promise<void> {
    const db = await getDb();
    db.run('DELETE FROM response_cache WHERE id = ?', [id]);
    requestSave();
  }

  /** 清理过期和多余的缓存 */
  private async cleanup(): Promise<void> {
    const db = await getDb();
    const now = Date.now();

    // 删除过期的缓存
    db.run('DELETE FROM response_cache WHERE created_at < ?', [now - this.TTL]);

    // 检查总条目数
    const countStmt = db.prepare('SELECT COUNT(*) FROM response_cache');
    let count = 0;
    if (countStmt.step()) {
      count = (countStmt.getAsObject() as Record<string, unknown>)['COUNT(*)'] as number;
    }
    countStmt.free();

    // 如果超过最大条目数，删除最久未使用的
    if (count > this.MAX_ENTRIES) {
      const excess = count - this.MAX_ENTRIES;
      db.run(
        'DELETE FROM response_cache WHERE id IN (SELECT id FROM response_cache ORDER BY last_used_at ASC LIMIT ?)',
        [excess],
      );
    }

    requestSave();
  }

  /** 清空所有缓存 */
  async clearAll(): Promise<void> {
    const db = await getDb();
    db.run('DELETE FROM response_cache');
    requestSave();
  }

  /** 获取缓存统计信息 */
  async getStats(): Promise<{ total: number; hitRate: number }> {
    const db = await getDb();

    const countStmt = db.prepare('SELECT COUNT(*) as total, SUM(use_count) as total_uses FROM response_cache');
    let total = 0;
    let totalUses = 0;
    if (countStmt.step()) {
      const row = countStmt.getAsObject() as Record<string, unknown>;
      total = row.total as number;
      totalUses = (row.total_uses as number) || 0;
    }
    countStmt.free();

    // 计算命中率（简化计算：总使用次数 / 总条目数）
    const hitRate = total > 0 ? totalUses / total : 0;

    return { total, hitRate };
  }
}

export const cacheManager = new CacheManager();
export default CacheManager;

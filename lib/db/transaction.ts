/**
 * 数据库事务辅助函数
 * 封装 BEGIN/COMMIT/ROLLBACK 模式，减少重复代码
 */

import type { Database } from 'sql.js';
import { requestSave } from './index';

/**
 * 在事务中执行操作
 * 自动处理 BEGIN、COMMIT、ROLLBACK 和持久化
 *
 * @param db - 数据库实例
 * @param fn - 要执行的操作
 * @param persist - 是否在 COMMIT 后持久化到磁盘（默认 true）
 */
export function withTransaction(db: Database, fn: () => void, persist = true): void {
  db.run('BEGIN');
  try {
    fn();
    db.run('COMMIT');
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
  if (persist) {
    requestSave();
  }
}

/**
 * 数据库事务辅助函数
 * 封装 BEGIN/COMMIT/ROLLBACK 模式，减少重复代码
 * 支持嵌套事务（通过 SAVEPOINT 实现）
 */

import type { Database } from 'sql.js';
import { requestSave } from './index';

/** 当前事务嵌套深度，用于支持嵌套事务 */
let transactionDepth = 0;

/**
 * 在事务中执行操作
 * 自动处理 BEGIN/COMMIT/ROLLBACK 和持久化
 * 支持嵌套调用：外层使用 BEGIN/COMMIT，内层使用 SAVEPOINT/RELEASE
 *
 * @param db - 数据库实例
 * @param fn - 要执行的操作
 * @param persist - 是否在最外层 COMMIT 后持久化到磁盘（默认 true）
 */
export function withTransaction(db: Database, fn: () => void, persist = true): void {
  const isNested = transactionDepth > 0;
  const savepointName = `sp_${transactionDepth}`;

  transactionDepth++;
  try {
    if (isNested) {
      db.run(`SAVEPOINT ${savepointName}`);
    } else {
      db.run('BEGIN');
    }

    fn();

    if (isNested) {
      db.run(`RELEASE SAVEPOINT ${savepointName}`);
    } else {
      db.run('COMMIT');
    }
  } catch (e) {
    if (isNested) {
      // 回滚到 SAVEPOINT，不影响外层事务
      try {
        db.run(`ROLLBACK TO SAVEPOINT ${savepointName}`);
      } catch { /* SAVEPOINT 可能已不存在，忽略 */ }
    } else {
      try {
        db.run('ROLLBACK');
      } catch (rollbackError) {
        // ROLLBACK 失败时，使用 cause 链接原始错误，避免丢失上下文
        console.error('[DB] ROLLBACK 失败:', rollbackError);
      }
    }
    throw e;
  } finally {
    transactionDepth--;
  }

  // 仅在最外层事务提交后持久化
  if (persist && transactionDepth === 0) {
    requestSave();
  }
}

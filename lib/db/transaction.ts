/**
 * 数据库事务辅助函数
 * 封装 BEGIN/COMMIT/ROLLBACK 模式，减少重复代码
 * 支持嵌套事务（通过 SAVEPOINT 实现）
 *
 * ⚠️ 重要约束：
 * - fn 参数必须是同步函数，不能包含 await 或返回 Promise
 * - 原因：transactionDepth 是模块级变量，异步操作会导致嵌套深度计算错误
 * - sql.js 是内存数据库，所有操作都是同步的，无需异步支持
 */

import type { Database } from 'sql.js';
import { requestSave } from './index';

/** 当前事务嵌套深度，用于支持嵌套事务 */
let transactionDepth = 0;

/** 获取当前事务深度（用于调试） */
export function getTransactionDepth(): number {
  return transactionDepth;
}

/**
 * 在事务中执行操作
 * 自动处理 BEGIN/COMMIT/ROLLBACK 和持久化
 * 支持嵌套调用：外层使用 BEGIN/COMMIT，内层使用 SAVEPOINT/RELEASE
 *
 * @param db - 数据库实例
 * @param fn - 要执行的操作（必须是同步函数）
 * @param persist - 是否在最外层 COMMIT 后持久化到磁盘（默认 true）
 * @throws 如果 fn 返回 Promise 则抛出错误
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

    const result = fn();

    // 运行时检查：如果 fn 返回了 Promise，抛出明确错误
    if (result !== undefined && result !== null && typeof (result as unknown as Promise<unknown>).then === 'function') {
      throw new Error(
        '[DB] withTransaction 的 fn 参数不能是异步函数。' +
        'transactionDepth 是模块级变量，异步操作会导致嵌套深度计算错误。' +
        '请将 fn 改为同步函数。'
      );
    }

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

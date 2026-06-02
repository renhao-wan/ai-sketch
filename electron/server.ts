/**
 * Next.js 服务器管理模块（占位符）
 *
 * 此模块负责启动和停止 Next.js 开发服务器。
 * 完整实现将在 Task 3 中完成。
 */

/**
 * 启动 Next.js 服务器
 * @param dbPath - SQLite 数据库文件路径
 * @returns 服务器监听的端口号
 */
export async function startServer(dbPath: string): Promise<number> {
  // TODO: Task 3 - 实现 Next.js 服务器启动逻辑
  console.log(`[Server] 占位符 - 数据库路径: ${dbPath}`);

  // 临时返回一个默认端口
  return 3000;
}

/**
 * 停止 Next.js 服务器
 */
export function stopServer(): void {
  // TODO: Task 3 - 实现服务器停止逻辑
  console.log('[Server] 占位符 - 服务器已停止');
}

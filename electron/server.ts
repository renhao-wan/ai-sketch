/**
 * Next.js 服务器管理模块
 *
 * 此模块负责启动和停止 Next.js 服务器，作为 Electron 主进程与 Next.js 应用之间的桥梁。
 * 核心职责：
 * 1. 通过环境变量将数据库路径传递给 Next.js API 路由
 * 2. 使用 Next.js 编程式 API 启动服务器
 * 3. 返回服务器端口号供主进程创建 BrowserWindow 使用
 */

import { createServer, type Server } from 'http';
import { parse } from 'url';
import next from 'next';
import path from 'path';

/** Next.js HTTP 服务器实例引用，用于停止时关闭 */
let server: Server | null = null;

/**
 * 通过环境变量设置数据库路径
 *
 * Next.js API 路由通过 `process.env.AI_SKETCH_DB_PATH` 读取此路径，
 * 从而使用 Electron 指定的应用数据目录而非项目根目录。
 *
 * @param dbPath - SQLite 数据库文件的绝对路径
 */
function setupDatabasePath(dbPath: string): void {
  process.env.AI_SKETCH_DB_PATH = dbPath;
}

/**
 * 启动 Next.js 服务器
 *
 * 执行流程：
 * 1. 设置数据库路径环境变量
 * 2. 创建 Next.js 应用实例（开发/生产模式自动判断）
 * 3. 调用 app.prepare() 完成编译初始化
 * 4. 创建 HTTP 服务器并委托请求给 Next.js 处理
 * 5. 监听随机端口并返回端口号
 *
 * @param dbPath - SQLite 数据库文件的绝对路径
 * @returns 服务器实际监听的端口号
 */
export async function startServer(dbPath: string): Promise<number> {
  setupDatabasePath(dbPath);

  // 开发模式下，Next.js 开发服务器已经由 concurrently 启动
  // 这里使用生产模式，避免锁文件冲突
  const dev = false;
  const hostname = 'localhost';
  const port = 0; // 使用 0 让操作系统分配随机可用端口

  // 创建 Next.js 应用实例
  // dir 指向项目根目录（electron 的上级目录）
  console.time('[Server] Next.js prepare');
  const app = next({
    dev,
    hostname,
    port,
    dir: path.join(__dirname, '..'),
  });

  const handle = app.getRequestHandler();

  // 完成 Next.js 初始化（开发模式下会触发编译）
  await app.prepare();
  console.timeEnd('[Server] Next.js prepare');

  return new Promise<number>((resolve, reject) => {
    server = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url!, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('[Server] 请求处理错误:', err);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    });

    server.listen(port, hostname, () => {
      const address = server!.address();
      if (address && typeof address === 'object') {
        resolve(address.port);
      } else {
        reject(new Error('无法获取服务器端口'));
      }
    });

    server.on('error', (err) => {
      console.error('[Server] 服务器错误:', err);
      reject(err);
    });
  });
}

/**
 * 停止 Next.js 服务器
 *
 * 关闭 HTTP 服务器并等待活跃连接关闭。在应用退出时调用。
 * @returns Promise，在服务器完全关闭后 resolve
 */
export function stopServer(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!server) {
      resolve();
      return;
    }
    const srv = server;
    server = null;
    let resolved = false;
    const safeResolve = () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };
    srv.close(safeResolve);
    // 如果 3 秒内没有关闭完成，强制 resolve（避免阻塞退出）
    setTimeout(safeResolve, 3000);
  });
}

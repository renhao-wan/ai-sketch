/**
 * Electron 主进程入口
 *
 * 职责：
 * 1. 创建和管理应用窗口
 * 2. 启动 Next.js 服务器
 * 3. 处理 IPC 通信
 * 4. 管理应用生命周期
 */

import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import path from 'path';
import { startServer, stopServer } from './server';

/** 主窗口实例 */
let mainWindow: BrowserWindow | null = null;

/** Next.js 服务器端口 */
let serverPort: number | null = null;

/** 应用数据目录路径（在 app.whenReady 后初始化） */
let userDataPath: string;

/** SQLite 数据库文件路径（在 app.whenReady 后初始化） */
let dbPath: string;

/**
 * 创建主窗口
 *
 * 配置窗口属性：
 * - 默认尺寸 1400x900，最小尺寸 800x600
 * - macOS 隐藏标题栏样式
 * - 启用上下文隔离，禁用 Node.js 集成（安全最佳实践）
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    frame: true, // 显示系统窗口框架
    titleBarStyle: 'hiddenInset', // macOS 隐藏标题栏
    icon: path.join(__dirname, '..', 'build', 'icon.png'), // 应用图标
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: false, // 禁用开发者工具
    },
  });

  // 加载 Next.js 服务器
  if (serverPort) {
    mainWindow.loadURL(`http://localhost:${serverPort}`);
  }

  // 窗口关闭时清理引用
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 隐藏菜单栏
Menu.setApplicationMenu(null);

// 应用就绪后启动
app.whenReady().then(async () => {
  try {
    // 初始化路径
    userDataPath = app.getPath('userData');
    dbPath = path.join(userDataPath, 'data', 'ai-sketch.db');

    // 启动 Next.js 服务器
    serverPort = await startServer(dbPath);

    // 创建窗口
    createWindow();
  } catch (error) {
    dialog.showErrorBox(
      '启动失败',
      `应用启动失败: ${(error as Error).message}`
    );
    app.quit();
  }
});

// 所有窗口关闭时退出应用（Windows/Linux）
app.on('window-all-closed', () => {
  stopServer();
  app.quit();
});

// macOS: 点击 dock 图标时重新创建窗口
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC 处理：获取数据目录路径
ipcMain.handle('get-user-data-path', () => {
  return userDataPath;
});

// IPC 处理：获取应用版本
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// IPC 处理：卸载前询问是否删除数据
ipcMain.handle('confirm-delete-data', async () => {
  const result = await dialog.showMessageBox({
    type: 'question',
    buttons: ['删除数据', '保留数据'],
    defaultId: 1,
    title: '卸载确认',
    message: '是否删除应用数据？',
    detail: '应用数据包括配置、对话历史等。删除后无法恢复。',
  });
  return result.response === 0; // 0 = 删除数据
});

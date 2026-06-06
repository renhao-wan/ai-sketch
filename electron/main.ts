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
import { closeDb } from '../lib/db/index';
import { loadWindowState, saveWindowState } from './window-state';

/** 主窗口实例 */
let mainWindow: BrowserWindow | null = null;

/** Next.js 服务器端口 */
let serverPort: number | null = null;

/** 应用数据目录路径（在 app.whenReady 后初始化） */
let userDataPath: string;

/** SQLite 数据库文件路径（在 app.whenReady 后初始化） */
let dbPath: string;

/** 开发模式端口（与 concurrently 启动的 Next.js 开发服务器一致） */
const DEV_PORT = 3000;

/** 是否为开发模式（通过环境变量判断） */
const isDev = process.env.ELECTRON_DEV === 'true';

/**
 * 创建主窗口
 *
 * 配置窗口属性：
 * - 默认尺寸 1400x900，最小尺寸 800x600
 * - 启用上下文隔离，禁用 Node.js 集成（安全最佳实践）
 * - 延迟显示（show: false + ready-to-show），避免启动时白屏闪烁
 */
function createWindow(): void {
  const savedState = loadWindowState();

  mainWindow = new BrowserWindow({
    x: savedState.x,
    y: savedState.y,
    width: savedState.width,
    height: savedState.height,
    minWidth: 800,
    minHeight: 600,
    frame: false, // 完全无边框，不显示原生标题栏和按钮
    show: false, // 延迟显示，等待页面加载完成后再展示
    backgroundColor: '#FAF8F5', // 与应用默认主题背景色一致，避免启动时白屏闪烁
    title: 'AI Sketch', // 窗口标题
    icon: path.join(__dirname, '..', 'electron', 'resources', 'icon.png'), // 应用图标
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: isDev, // 开发模式启用开发者工具
    },
  });

  // 加载 Next.js 服务器
  const port = isDev ? DEV_PORT : serverPort;
  if (port) {
    mainWindow.loadURL(`http://localhost:${port}`);
  }

  // 页面加载完成后再显示窗口，恢复最大化状态
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    if (savedState.isMaximized) {
      mainWindow?.maximize();
    }
  });

  // 窗口移动/调整大小时保存状态
  const saveCurrentState = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const bounds = mainWindow.getBounds();
    saveWindowState({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: mainWindow.isMaximized(),
    });
  };
  mainWindow.on('resize', saveCurrentState);
  mainWindow.on('move', saveCurrentState);

  // 窗口最大化/还原时主动通知渲染进程（更新图标）
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window-maximize-changed', true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window-maximize-changed', false);
  });

  // 崩溃恢复：渲染进程崩溃时提示用户重新加载
  mainWindow.webContents.on('render-process-gone', async (_event, details) => {
    console.error('[Electron] Render process gone:', details.reason);
    const { response } = await dialog.showMessageBox({
      type: 'error',
      title: '页面崩溃',
      message: '页面发生崩溃，是否重新加载？',
      detail: `原因: ${details.reason}`,
      buttons: ['重新加载', '关闭'],
      defaultId: 0,
    });
    if (response === 0) {
      mainWindow?.webContents.reload();
    } else {
      mainWindow?.close();
    }
  });

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

    // 生产模式下启动 Next.js 服务器
    if (!isDev) {
      serverPort = await startServer(dbPath);
    }

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
app.on('window-all-closed', async () => {
  await stopServer();
  closeDb();
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

// IPC 处理：窗口控制
ipcMain.handle('window-minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window-maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow?.isMaximized() ?? false;
});

ipcMain.handle('window-close', () => {
  mainWindow?.close();
});

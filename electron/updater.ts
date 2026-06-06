/**
 * 自动更新模块
 * 使用 electron-updater 检查 GitHub Releases 的新版本
 */

import { autoUpdater, UpdateInfo } from 'electron-updater';
import { BrowserWindow, dialog } from 'electron';

/** 更新状态 */
export type UpdateStatus = 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';

/** 向渲染进程发送更新状态 */
function sendStatus(window: BrowserWindow | null, status: UpdateStatus, data?: unknown) {
  if (window && !window.isDestroyed()) {
    window.webContents.send('update-status', { status, data });
  }
}

/** 初始化自动更新 */
export function initAutoUpdater(mainWindow: BrowserWindow | null): void {
  // 关闭自动下载，由用户手动触发
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  // 允许开发模式下检查更新（未打包时默认跳过）
  autoUpdater.forceDevUpdateConfig = true;

  autoUpdater.on('checking-for-update', () => {
    sendStatus(mainWindow, 'checking');
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    sendStatus(mainWindow, 'available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseName: info.releaseName,
    });
  });

  autoUpdater.on('update-not-available', () => {
    sendStatus(mainWindow, 'not-available');
  });

  autoUpdater.on('download-progress', (progress) => {
    sendStatus(mainWindow, 'downloading', {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on('update-downloaded', () => {
    sendStatus(mainWindow, 'downloaded');
  });

  autoUpdater.on('error', (error) => {
    console.error('[Updater] Error:', error.message);
    sendStatus(mainWindow, 'error', error.message);
  });

  // 启动后延迟 5 秒检查更新（避免影响启动速度）
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[Updater] Check failed:', err.message);
    });
  }, 5000);
}

/** 手动检查更新 */
export function checkForUpdates(mainWindow: BrowserWindow | null): void {
  autoUpdater.checkForUpdates()
    .then((result) => {
      console.log('[Updater] Check result:', result ? 'found' : 'none');
    })
    .catch((err) => {
      console.error('[Updater] Manual check failed:', err.message);
      sendStatus(mainWindow, 'error', err.message);
    });
}

/** 下载更新 */
export function downloadUpdate(mainWindow: BrowserWindow | null): void {
  autoUpdater.downloadUpdate().catch((err) => {
    console.error('[Updater] Download failed:', err.message);
    sendStatus(mainWindow, 'error', err.message);
  });
}

/** 安装更新并重启 */
export function quitAndInstall(): void {
  autoUpdater.quitAndInstall(false, true);
}

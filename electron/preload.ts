import { contextBridge, ipcRenderer } from 'electron';

/**
 * 预加载脚本 - 暴露安全的 API 给渲染进程
 *
 * 通过 contextBridge 暴露的 API 可以在渲染进程中通过 window.electronAPI 访问
 * 所有 IPC 通信都通过 invoke/handle 模式实现，确保安全性
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * 获取用户数据目录路径
   * @returns 用户数据目录的绝对路径
   */
  getUserDataPath: (): Promise<string> => ipcRenderer.invoke('get-user-data-path'),

  /**
   * 确认删除数据
   * 显示确认对话框，询问用户是否删除应用数据
   * @returns true 表示用户确认删除，false 表示取消
   */
  confirmDeleteData: (): Promise<boolean> => ipcRenderer.invoke('confirm-delete-data'),

  /**
   * 获取应用版本号
   * @returns 应用版本号字符串
   */
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),

  /**
   * 自动更新 API
   */
  update: {
    /** 手动检查更新 */
    check: () => ipcRenderer.invoke('update-check'),
    /** 下载更新 */
    download: () => ipcRenderer.invoke('update-download'),
    /** 安装更新并重启 */
    install: () => ipcRenderer.invoke('update-install'),
    /** 监听更新状态变化 */
    onStatus: (callback: (data: { status: string; data?: unknown }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { status: string; data?: unknown }) => callback(data);
      ipcRenderer.on('update-status', handler);
      return () => {
        ipcRenderer.removeListener('update-status', handler);
      };
    },
  },

  /**
   * 重置窗口状态（删除窗口位置/大小记录）
   * @returns { success: boolean, error?: string }
   */
  resetWindowState: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('reset-window-state'),

  /**
   * 窗口控制 API
   */
  window: {
    /** 最小化窗口 */
    minimize: () => ipcRenderer.invoke('window-minimize'),
    /** 最大化/还原窗口 */
    maximize: () => ipcRenderer.invoke('window-maximize'),
    /** 关闭窗口 */
    close: () => ipcRenderer.invoke('window-close'),
    /** 检查窗口是否最大化 */
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window-is-maximized'),
    /** 监听窗口最大化状态变化，返回清理函数用于移除监听器 */
    onMaximizeChange: (callback: (isMaximized: boolean) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, value: boolean) => callback(value);
      ipcRenderer.on('window-maximize-changed', handler);
      return () => {
        ipcRenderer.removeListener('window-maximize-changed', handler);
      };
    },
  },
});

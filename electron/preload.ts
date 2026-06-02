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
});

/**
 * Electron API 类型声明
 *
 * 为 window.electronAPI 提供 TypeScript 类型支持
 */

interface ElectronWindowAPI {
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  onMaximizeChange: (callback: (isMaximized: boolean) => void) => () => void;
}

interface ElectronAPI {
  getUserDataPath: () => Promise<string>;
  confirmDeleteData: () => Promise<boolean>;
  getAppVersion: () => Promise<string>;
  window: ElectronWindowAPI;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};

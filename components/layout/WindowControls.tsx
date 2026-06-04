'use client';

/**
 * 窗口控制组件
 *
 * 用于无边框窗口的最小化、最大化、关闭按钮
 * 仅在 Electron 环境下显示
 * 样式与应用整体毛玻璃风格一致
 */

import { useState, useEffect } from 'react';
import { Minus, Square, X, Copy } from 'lucide-react';
import Tooltip from '@/components/ui/Tooltip';
import { useLocale } from '@/lib/locales';

export default function WindowControls() {
  const { t } = useLocale();
  const [isMaximized, setIsMaximized] = useState(false);
  const [isElectron, setIsElectron] = useState(false);

  const handleMinimize = () => {
    window.electronAPI?.window?.minimize();
  };

  const handleMaximize = () => {
    window.electronAPI?.window?.maximize();
  };

  const handleClose = () => {
    window.electronAPI?.window?.close();
  };

  /* eslint-disable react-hooks/set-state-in-effect -- 从外部系统（Electron）同步状态，仅执行一次 */
  useEffect(() => {
    // 检查是否在 Electron 环境中
    const electronAPI = typeof window !== 'undefined' ? window.electronAPI : undefined;
    if (!electronAPI?.window) return;
    setIsElectron(true);

    // 初始检测最大化状态
    electronAPI.window.isMaximized().then(setIsMaximized).catch(console.error);

    // 监听主进程推送的最大化状态变化（事件驱动，无延迟）
    const cleanupMaximize: unknown = electronAPI.window.onMaximizeChange(setIsMaximized);

    // 注册快捷键
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'F9') { e.preventDefault(); handleMinimize(); }
      if (e.altKey && e.key === 'F10') { e.preventDefault(); handleMaximize(); }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (typeof cleanupMaximize === 'function') cleanupMaximize();
    };
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // 非 Electron 环境不渲染
  if (!isElectron) return null;

  return (
    <div className="flex items-center ml-2 pl-2 border-l border-[var(--border)]/30">
      <Tooltip content={t('window.minimize')} side="bottom">
        <button
          onClick={handleMinimize}
          className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-150"
        >
          <Minus size={14} strokeWidth={1.5} />
        </button>
      </Tooltip>
      <Tooltip content={isMaximized ? t('window.restore') : t('window.maximize')} side="bottom">
        <button
          onClick={handleMaximize}
          className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-150 ml-0.5"
        >
          {isMaximized ? <Copy size={12} strokeWidth={1.5} /> : <Square size={12} strokeWidth={1.5} />}
        </button>
      </Tooltip>
      <Tooltip content={t('window.close')} side="bottom">
        <button
          onClick={handleClose}
          className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--muted)] hover:text-white hover:bg-red-500/80 transition-all duration-150 ml-0.5"
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      </Tooltip>
    </div>
  );
}

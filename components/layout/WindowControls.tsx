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

  useEffect(() => {
    // 检查是否在 Electron 环境中
    setIsElectron(typeof window !== 'undefined' && !!window.electronAPI);

    // 监听窗口最大化状态变化
    const checkMaximized = async () => {
      if (window.electronAPI?.window) {
        const maximized = await window.electronAPI.window.isMaximized();
        setIsMaximized(maximized);
      }
    };

    checkMaximized();

    // 定期检查最大化状态（简单实现）
    const interval = setInterval(checkMaximized, 500);

    // 注册快捷键
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt+F9 - 最小化
      if (e.altKey && e.key === 'F9') {
        e.preventDefault();
        handleMinimize();
      }
      // Alt+F10 - 最大化/还原
      if (e.altKey && e.key === 'F10') {
        e.preventDefault();
        handleMaximize();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearInterval(interval);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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

'use client';

import { useEffect } from 'react';
import { LocaleProvider } from '@/lib/locales';
import { SettingsProvider } from '@/hooks/useSettings';
import { NotificationProvider } from '@/lib/contexts/NotificationContext';
import type { ReactNode } from 'react';

/**
 * 页面卸载时保存数据库
 * 使用 navigator.sendBeacon 确保在页面关闭前请求能被发送
 */
function useSaveOnUnload() {
  useEffect(() => {
    const handleBeforeUnload = () => {
      // 使用 sendBeacon 确保请求在页面关闭前能被发送
      navigator.sendBeacon('/api/db/save');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);
}

export default function ClientProviders({ children }: { children: ReactNode }) {
  useSaveOnUnload();

  return (
    <SettingsProvider>
      <LocaleProvider>
        <NotificationProvider>
          {children}
        </NotificationProvider>
      </LocaleProvider>
    </SettingsProvider>
  );
}

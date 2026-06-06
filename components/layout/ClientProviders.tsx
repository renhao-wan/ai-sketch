'use client';

import { LocaleProvider } from '@/lib/locales';
import { SettingsProvider } from '@/hooks/useSettings';
import { NotificationProvider } from '@/lib/contexts/NotificationContext';
import type { ReactNode } from 'react';

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <LocaleProvider>
        <NotificationProvider>{children}</NotificationProvider>
      </LocaleProvider>
    </SettingsProvider>
  );
}

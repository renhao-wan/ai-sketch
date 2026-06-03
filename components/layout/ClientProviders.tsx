'use client';

import { LocaleProvider } from '@/lib/locales';
import { SettingsProvider } from '@/hooks/useSettings';
import type { ReactNode } from 'react';

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <LocaleProvider>{children}</LocaleProvider>
    </SettingsProvider>
  );
}

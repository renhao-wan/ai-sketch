'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { zh } from './zh';
import { en } from './en';
import type { TranslationKey, TranslationDict } from './zh';

export type { TranslationKey, TranslationDict };

export type Locale = 'zh' | 'en';

const dictionaries: Record<Locale, TranslationDict> = { zh, en };

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
}

export const LocaleContext = createContext<LocaleContextValue | null>(null);

const STORAGE_KEY = 'ai-sketch-locale';

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'zh' || stored === 'en') {
        document.documentElement.lang = stored === 'zh' ? 'zh-CN' : 'en';
        return stored;
      }
    }
    return 'zh';
  });

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(STORAGE_KEY, newLocale);
    document.documentElement.lang = newLocale === 'zh' ? 'zh-CN' : 'en';
  }, []);

  const t = useCallback((key: TranslationKey): string => {
    return dictionaries[locale][key] ?? key;
  }, [locale]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}

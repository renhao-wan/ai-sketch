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

export function LocaleProvider({ children }: { children: ReactNode }) {
  // 初始值统一为 'zh'（SSR 安全），mount 后从数据库读取真实值
  const [locale, setLocaleState] = useState<Locale>('zh');

  useEffect(() => {
    const loadLocale = async () => {
      try {
        const res = await fetch('/api/configs/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get-preference', key: 'preference_locale' }),
        });
        const data = await res.json();
        if (data.value === 'zh' || data.value === 'en') {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- 从数据库同步语言设置，仅执行一次
          setLocaleState(data.value);
          document.documentElement.lang = data.value === 'zh' ? 'zh-CN' : 'en';
        }
      } catch {
        // 加载失败保持默认 'zh'
      }
    };
    loadLocale();
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    document.documentElement.lang = newLocale === 'zh' ? 'zh-CN' : 'en';
    // 异步保存到数据库
    fetch('/api/configs/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set-preference', key: 'preference_locale', value: newLocale }),
    }).catch(() => { /* 忽略保存失败 */ });
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

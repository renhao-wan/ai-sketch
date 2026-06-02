'use client';

import { useState, useEffect, useCallback } from 'react';

export type Theme = 'dark' | 'light' | 'ocean' | 'sakura' | 'emerald' | 'sunset';

export interface Settings {
  locale: 'zh' | 'en';
  theme: Theme;
}

const DEFAULT_SETTINGS: Settings = {
  locale: 'zh',
  theme: 'light',
};

const STORAGE_KEYS = {
  locale: 'ai-sketch-locale',
  theme: 'ai-sketch-theme',
} as const;

function getStoredValue<T>(key: string, defaultValue: T, validator?: (v: unknown) => v is T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return defaultValue;
    const parsed = JSON.parse(stored);
    if (validator && !validator(parsed)) return defaultValue;
    return parsed;
  } catch {
    return defaultValue;
  }
}

function isValidTheme(v: unknown): v is Theme {
  return typeof v === 'string' && ['dark', 'light', 'ocean', 'sakura', 'emerald', 'sunset'].includes(v);
}

function isValidLocale(v: unknown): v is 'zh' | 'en' {
  return v === 'zh' || v === 'en';
}

export function useSettings() {
  // 初始值统一使用默认值（SSR 安全），mount 后从 localStorage 读取真实值
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  // 从 localStorage 读取已保存的设置（仅客户端）
  useEffect(() => {
    const locale = getStoredValue(STORAGE_KEYS.locale, DEFAULT_SETTINGS.locale, isValidLocale);
    const theme = getStoredValue(STORAGE_KEYS.theme, DEFAULT_SETTINGS.theme, isValidTheme);
    setSettings(prev => {
      if (prev.locale === locale && prev.theme === theme) return prev;
      return { locale, theme };
    });
  }, []);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  const updateSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(value));
      return next;
    });
  }, []);

  return { settings, updateSetting };
}

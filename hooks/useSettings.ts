'use client';

import { useState, useEffect, useCallback } from 'react';

export type Theme = 'dark' | 'light' | 'warm' | 'cool' | 'forest' | 'lavender';

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
  return typeof v === 'string' && ['dark', 'light', 'warm', 'cool', 'forest', 'lavender'].includes(v);
}

function isValidLocale(v: unknown): v is 'zh' | 'en' {
  return v === 'zh' || v === 'en';
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => ({
    locale: getStoredValue(STORAGE_KEYS.locale, DEFAULT_SETTINGS.locale, isValidLocale),
    theme: getStoredValue(STORAGE_KEYS.theme, DEFAULT_SETTINGS.theme, isValidTheme),
  }));

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

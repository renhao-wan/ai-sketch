'use client';

import { useState, useEffect, useCallback } from 'react';

export type Theme = 'dark' | 'light' | 'warm' | 'cool' | 'forest' | 'lavender';
export type CanvasBg = 'grid' | 'dots' | 'blank';

export interface Settings {
  locale: 'zh' | 'en';
  theme: Theme;
  canvasBg: CanvasBg;
}

const DEFAULT_SETTINGS: Settings = {
  locale: 'zh',
  theme: 'light',
  canvasBg: 'grid',
};

const STORAGE_KEYS = {
  locale: 'ai-sketch-locale',
  theme: 'ai-sketch-theme',
  canvasBg: 'ai-sketch-canvas-bg',
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

function isValidCanvasBg(v: unknown): v is CanvasBg {
  return typeof v === 'string' && ['grid', 'dots', 'blank'].includes(v);
}

function isValidLocale(v: unknown): v is 'zh' | 'en' {
  return v === 'zh' || v === 'en';
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => ({
    locale: getStoredValue(STORAGE_KEYS.locale, DEFAULT_SETTINGS.locale, isValidLocale),
    theme: getStoredValue(STORAGE_KEYS.theme, DEFAULT_SETTINGS.theme, isValidTheme),
    canvasBg: getStoredValue(STORAGE_KEYS.canvasBg, DEFAULT_SETTINGS.canvasBg, isValidCanvasBg),
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

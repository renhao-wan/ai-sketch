'use client';

import { useState, useEffect, useCallback, useContext, createContext, useMemo } from 'react';

export type Theme = 'dark' | 'light' | 'ocean' | 'sakura' | 'emerald' | 'sunset';

export interface Settings {
  theme: Theme;
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
};

const VALID_THEMES: Theme[] = ['dark', 'light', 'ocean', 'sakura', 'emerald', 'sunset'];

interface SettingsContextValue {
  settings: Settings;
  isLoaded: boolean;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  resetPreferences: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // 从数据库加载设置（仅客户端）
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/configs/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'get-all-preferences',
            keys: ['preference_theme'],
          }),
        });
        const data = await res.json();

        const savedTheme = data.preference_theme;

        const theme = (savedTheme && VALID_THEMES.includes(savedTheme as Theme))
          ? savedTheme as Theme
          : DEFAULT_SETTINGS.theme;

        setSettings(prev => {
          if (prev.theme === theme) return prev;
          return { theme };
        });
      } catch {
        // 加载失败使用默认值
      } finally {
        setIsLoaded(true);
      }
    };
    loadSettings();
  }, []);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  const updateSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    // 异步保存到数据库
    if (key === 'theme') {
      fetch('/api/configs/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-preference', key: 'preference_theme', value: String(value) }),
      }).catch(() => { /* 忽略保存失败 */ });
    }
  }, []);

  const resetPreferences = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    document.documentElement.dataset.theme = DEFAULT_SETTINGS.theme;
    // 重置数据库中的偏好设置
    fetch('/api/configs/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set-preference', key: 'preference_theme', value: 'light' }),
    }).catch(() => {});
  }, []);

  const value = useMemo(() => ({ settings, isLoaded, updateSetting, resetPreferences }),
    [settings, isLoaded, updateSetting, resetPreferences]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

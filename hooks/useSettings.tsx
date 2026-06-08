'use client';

import { useState, useEffect, useCallback, useContext, createContext } from 'react';

export type Theme = 'dark' | 'light' | 'ocean' | 'sakura' | 'emerald' | 'sunset';

export interface Settings {
  theme: Theme;
  glowEnabled: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  glowEnabled: false,
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
            keys: ['preference_theme', 'preference_glow_enabled'],
          }),
        });
        const data = await res.json();

        const savedTheme = data.preference_theme;
        const savedGlow = data.preference_glow_enabled;

        const theme = (savedTheme && VALID_THEMES.includes(savedTheme as Theme))
          ? savedTheme as Theme
          : DEFAULT_SETTINGS.theme;
        const glowEnabled = savedGlow === 'true';

        setSettings(prev => {
          if (prev.theme === theme && prev.glowEnabled === glowEnabled) return prev;
          return { theme, glowEnabled };
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
    const metaKey = key === 'theme' ? 'preference_theme' : 'preference_glow_enabled';
    const metaValue = String(value);
    fetch('/api/configs/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set-preference', key: metaKey, value: metaValue }),
    }).catch(() => { /* 忽略保存失败 */ });
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
    fetch('/api/configs/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set-preference', key: 'preference_glow_enabled', value: 'false' }),
    }).catch(() => {});
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, isLoaded, updateSetting, resetPreferences }}>
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

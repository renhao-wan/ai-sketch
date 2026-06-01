'use client';

import { useLocale } from '@/locales';
import { useSettings, Theme } from '@/hooks/useSettings';
import { Check } from 'lucide-react';

const themes: { key: Theme; color: string }[] = [
  { key: 'dark', color: '#1a1a2e' },
  { key: 'light', color: '#FAF8F5' },
  { key: 'warm', color: '#1c1412' },
  { key: 'cool', color: '#0f172a' },
  { key: 'forest', color: '#0f1f1a' },
  { key: 'lavender', color: '#1e1b2e' },
];

export function AppearanceSettings() {
  const { t, locale, setLocale } = useLocale();
  const { settings, updateSetting } = useSettings();

  return (
    <div className="space-y-8">
      {/* 语言设置 */}
      <section>
        <h3 className="text-lg font-semibold text-[var(--fg)] mb-1">{t('settings.language')}</h3>
        <div className="flex gap-3">
          <button
            onClick={() => setLocale('zh')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              locale === 'zh'
                ? 'bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)] border border-[var(--accent-indigo)]/20'
                : 'bg-[var(--surface-warm-hover)] text-[var(--muted)] border border-transparent hover:text-[var(--fg)]'
            }`}
          >
            中文
          </button>
          <button
            onClick={() => setLocale('en')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              locale === 'en'
                ? 'bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)] border border-[var(--accent-indigo)]/20'
                : 'bg-[var(--surface-warm-hover)] text-[var(--muted)] border border-transparent hover:text-[var(--fg)]'
            }`}
          >
            English
          </button>
        </div>
      </section>

      {/* 主题设置 */}
      <section>
        <h3 className="text-lg font-semibold text-[var(--fg)] mb-1">{t('settings.theme')}</h3>
        <div className="grid grid-cols-3 gap-3">
          {themes.map(({ key, color }) => (
            <button
              key={key}
              onClick={() => updateSetting('theme', key)}
              className={`
                relative flex items-center gap-3 p-3 rounded-xl border transition-all duration-200
                ${settings.theme === key
                  ? 'border-[var(--accent-indigo)] bg-[var(--accent-indigo)]/5'
                  : 'border-[var(--border)] hover:border-[var(--muted)]/30'
                }
              `}
            >
              <div
                className="w-8 h-8 rounded-lg border border-[var(--border)] shadow-sm"
                style={{ backgroundColor: color }}
              />
              <span className="text-sm font-medium text-[var(--fg)]">
                {t(`settings.themes.${key}`)}
              </span>
              {settings.theme === key && (
                <Check size={14} className="absolute top-2 right-2 text-[var(--accent-indigo)]" />
              )}
            </button>
          ))}
        </div>
      </section>

      {/* 全局字体大小 */}
      <section>
        <h3 className="text-lg font-semibold text-[var(--fg)] mb-1">{t('settings.fontSize')}</h3>
        <p className="text-sm text-[var(--muted)] mb-3">{t('settings.fontSizeDesc')}</p>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={12}
            max={20}
            step={1}
            value={settings.globalFontSize}
            onChange={(e) => updateSetting('globalFontSize', Number(e.target.value))}
            className="flex-1 h-2 bg-[var(--surface-warm-hover)] rounded-lg appearance-none cursor-pointer accent-[var(--accent-indigo)]"
          />
          <span className="text-sm font-mono text-[var(--fg)] w-12 text-right">
            {settings.globalFontSize}px
          </span>
        </div>
      </section>
    </div>
  );
}

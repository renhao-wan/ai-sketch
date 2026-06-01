'use client';

import { useLocale } from '@/locales';
import { useSettings, Theme } from '@/hooks/useSettings';
import { Check } from 'lucide-react';

const themes: { key: Theme; bg: string; fg: string; accent: string }[] = [
  { key: 'dark', bg: '#1a1a2e', fg: '#e0e0e0', accent: '#818cf8' },
  { key: 'light', bg: '#FAF8F5', fg: '#1C1917', accent: '#7C3AED' },
  { key: 'warm', bg: '#1c1412', fg: '#fef3c7', accent: '#fbbf24' },
  { key: 'cool', bg: '#0f172a', fg: '#e2e8f0', accent: '#38bdf8' },
  { key: 'forest', bg: '#0f1f1a', fg: '#d1fae5', accent: '#34d399' },
  { key: 'lavender', bg: '#1e1b2e', fg: '#ede9fe', accent: '#a78bfa' },
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {themes.map(({ key, bg, fg, accent }) => (
            <button
              key={key}
              onClick={() => updateSetting('theme', key)}
              className={`
                relative overflow-hidden rounded-xl border-2 transition-all duration-200
                ${settings.theme === key
                  ? 'border-[var(--accent-indigo)] ring-2 ring-[var(--accent-indigo)]/20'
                  : 'border-[var(--border)] hover:border-[var(--muted)]/30'
                }
              `}
            >
              {/* Theme preview */}
              <div
                className="p-3 space-y-2"
                style={{ backgroundColor: bg }}
              >
                {/* Preview header */}
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: accent }} />
                  <div className="h-2 w-16 rounded-full" style={{ backgroundColor: fg, opacity: 0.6 }} />
                </div>
                {/* Preview content */}
                <div className="space-y-1.5">
                  <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: fg, opacity: 0.3 }} />
                  <div className="h-1.5 w-3/4 rounded-full" style={{ backgroundColor: fg, opacity: 0.2 }} />
                </div>
                {/* Preview accent bar */}
                <div className="h-1 w-12 rounded-full" style={{ backgroundColor: accent }} />
              </div>
              {/* Theme name */}
              <div className="px-3 py-2 bg-[var(--surface-warm)] border-t border-[var(--border)]">
                <span className="text-xs font-medium text-[var(--fg)]">
                  {t(`settings.themes.${key}`)}
                </span>
              </div>
              {/* Check icon */}
              {settings.theme === key && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[var(--accent-indigo)] flex items-center justify-center">
                  <Check size={12} className="text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* 全局字体大小 */}
      <section>
        <h3 id="fontSizeLabel" className="text-lg font-semibold text-[var(--fg)] mb-1">{t('settings.fontSize')}</h3>
        <p className="text-sm text-[var(--muted)] mb-3">{t('settings.fontSizeDesc')}</p>
        <div className="flex items-center gap-4">
          <input
            type="range"
            aria-labelledby="fontSizeLabel"
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

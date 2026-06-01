'use client';

import { useLocale, type TranslationKey } from '@/locales';
import { useSettings, CanvasBg } from '@/hooks/useSettings';

const canvasBgOptions: { key: CanvasBg; labelKey: TranslationKey }[] = [
  { key: 'grid', labelKey: 'settings.canvasBgOptions.grid' },
  { key: 'dots', labelKey: 'settings.canvasBgOptions.dots' },
  { key: 'blank', labelKey: 'settings.canvasBgOptions.blank' },
];

export function EditorSettings() {
  const { t } = useLocale();
  const { settings, updateSetting } = useSettings();

  return (
    <div className="space-y-8">
      {/* 画布背景 */}
      <section>
        <h3 className="text-lg font-semibold text-[var(--fg)] mb-1">{t('settings.canvasBg')}</h3>
        <p className="text-sm text-[var(--muted)] mb-3">{t('settings.canvasBgDesc')}</p>
        <div className="flex gap-3">
          {canvasBgOptions.map(({ key, labelKey }) => (
            <button
              key={key}
              onClick={() => updateSetting('canvasBg', key)}
              className={`
                px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200
                ${settings.canvasBg === key
                  ? 'bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)] border border-[var(--accent-indigo)]/20'
                  : 'bg-[var(--surface-warm-hover)] text-[var(--muted)] border border-transparent hover:text-[var(--fg)]'
                }
              `}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

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
      {/* 编辑器字体大小 */}
      <section>
        <h3 id="editorFontSizeLabel" className="text-lg font-semibold text-[var(--fg)] mb-1">{t('settings.editorFontSize')}</h3>
        <p className="text-sm text-[var(--muted)] mb-3">{t('settings.editorFontSizeDesc')}</p>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={12}
            max={20}
            step={1}
            aria-labelledby="editorFontSizeLabel"
            value={settings.editorFontSize}
            onChange={(e) => updateSetting('editorFontSize', Number(e.target.value))}
            className="flex-1 h-2 bg-[var(--surface-warm-hover)] rounded-lg appearance-none cursor-pointer accent-[var(--accent-indigo)]"
          />
          <span className="text-sm font-mono text-[var(--fg)] w-12 text-right">
            {settings.editorFontSize}px
          </span>
        </div>
      </section>

      {/* 自动保存 */}
      <section>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[var(--fg)] mb-1">{t('settings.autoSave')}</h3>
            <p className="text-sm text-[var(--muted)]">{t('settings.autoSaveDesc')}</p>
          </div>
          <button
            role="switch"
            aria-checked={settings.autoSave}
            aria-label={t('settings.autoSave')}
            onClick={() => updateSetting('autoSave', !settings.autoSave)}
            className={`
              relative w-12 h-7 rounded-full transition-colors duration-200
              ${settings.autoSave ? 'bg-[var(--accent-indigo)]' : 'bg-[var(--surface-warm-hover)]'}
            `}
          >
            <div
              className={`
                absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200
                ${settings.autoSave ? 'translate-x-6' : 'translate-x-1'}
              `}
            />
          </button>
        </div>
      </section>

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

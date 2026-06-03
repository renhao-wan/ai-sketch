'use client';

import { useMemo } from 'react';
import { useLocale, type TranslationKey } from '@/lib/locales';
import { useShortcuts, formatKeys } from '@/hooks/useShortcuts';
import { Keyboard, Navigation, Settings, Edit3, AppWindow } from 'lucide-react';
import type { Shortcut } from '@/lib/types/shortcuts';

interface KeyboardShortcutsSettingsProps {
  searchQuery?: string;
}

/** 快捷键分类 */
const SHORTCUT_CATEGORIES: { id: string; labelKey: TranslationKey; icon: typeof Navigation; shortcutIds: string[] }[] = [
  {
    id: 'navigation',
    labelKey: 'shortcuts.category.navigation',
    icon: Navigation,
    shortcutIds: ['go-home', 'new-conversation', 'open-history'],
  },
  {
    id: 'settings',
    labelKey: 'shortcuts.category.settings',
    icon: Settings,
    shortcutIds: ['open-settings', 'open-appearance', 'open-llm', 'open-conversations', 'open-data', 'open-network', 'open-about'],
  },
  {
    id: 'edit',
    labelKey: 'shortcuts.category.edit',
    icon: Edit3,
    shortcutIds: ['send-message', 'newline', 'undo', 'cut', 'copy', 'paste', 'select-all'],
  },
  {
    id: 'window',
    labelKey: 'shortcuts.category.window',
    icon: AppWindow,
    shortcutIds: ['window-minimize', 'window-maximize', 'window-close'],
  },
];

export function KeyboardShortcutsSettings({ searchQuery = '' }: KeyboardShortcutsSettingsProps) {
  const { t } = useLocale();
  const { shortcuts, filteredShortcuts } = useShortcuts();

  // 按分类分组
  const categorizedShortcuts = useMemo(() => {
    const filteredIds = new Set(filteredShortcuts.map(s => s.id));

    return SHORTCUT_CATEGORIES.map(category => ({
      ...category,
      shortcuts: shortcuts.filter(s =>
        category.shortcutIds.includes(s.id) && filteredIds.has(s.id)
      ),
    })).filter(category => category.shortcuts.length > 0);
  }, [shortcuts, filteredShortcuts]);

  return (
    <div className="space-y-6">
      {categorizedShortcuts.map(category => {
        const Icon = category.icon;
        return (
          <div key={category.id} className="space-y-3">
            {/* 分类标题 */}
            <div className="flex items-center gap-2">
              <Icon size={16} className="text-[var(--accent-indigo)]" />
              <h3 className="text-sm font-semibold text-[var(--fg)]">
                {t(category.labelKey)}
              </h3>
            </div>

            {/* 快捷键列表 */}
            <div className="space-y-2">
              {category.shortcuts.map(shortcut => (
                <div
                  key={shortcut.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-warm)] border border-[var(--border)]"
                >
                  <span className="text-sm text-[var(--fg)]">{shortcut.description}</span>
                  <div className="flex gap-1">
                    {shortcut.keys.map((key, index) => (
                      <kbd
                        key={index}
                        className="px-2 py-1 text-xs font-mono bg-[var(--surface-warm-hover)] border border-[var(--border)] rounded-md"
                      >
                        {key}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* 空状态 */}
      {categorizedShortcuts.length === 0 && (
        <div className="text-center py-8">
          <Keyboard size={32} className="mx-auto mb-3 text-[var(--muted)]" />
          <p className="text-sm text-[var(--muted)]">
            {searchQuery ? '没有找到匹配的快捷键' : '暂无快捷键'}
          </p>
        </div>
      )}
    </div>
  );
}

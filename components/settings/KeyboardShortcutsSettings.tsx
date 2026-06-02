'use client';

import { useMemo } from 'react';
import { useLocale } from '@/locales';
import { useShortcuts, formatKeys } from '@/hooks/useShortcuts';
import { Keyboard } from 'lucide-react';
import type { Shortcut } from '@/types/shortcuts';

interface KeyboardShortcutsSettingsProps {
  searchQuery?: string;
}

export function KeyboardShortcutsSettings({ searchQuery = '' }: KeyboardShortcutsSettingsProps) {
  const { t } = useLocale();
  const { filteredShortcuts } = useShortcuts();

  return (
    <div className="space-y-6">
      {/* 快捷键列表 */}
      <div className="space-y-2">
        {filteredShortcuts.map(shortcut => (
          <div
            key={shortcut.id}
            className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-warm)] border border-[var(--border)]"
          >
            <div className="flex items-center gap-3">
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
              <span className="text-sm text-[var(--fg)]">{shortcut.description}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 空状态 */}
      {filteredShortcuts.length === 0 && (
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

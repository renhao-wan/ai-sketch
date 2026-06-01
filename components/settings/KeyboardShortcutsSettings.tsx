'use client';

import { useState, useMemo } from 'react';
import { useLocale } from '@/locales';
import { useShortcuts, formatKeys } from '@/hooks/useShortcuts';
import { Search, Keyboard, RotateCcw } from 'lucide-react';
import type { Shortcut, ShortcutScope } from '@/types/shortcuts';

interface ShortcutItemProps {
  shortcut: Shortcut;
  enabled: boolean;
  onToggle: (id: string) => void;
}

function ShortcutItem({ shortcut, enabled, onToggle }: ShortcutItemProps) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-warm)] border border-[var(--border)]">
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
      <button
        onClick={() => onToggle(shortcut.id)}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
          enabled
            ? 'bg-[var(--accent-indigo)]'
            : 'bg-[var(--surface-warm-hover)] border border-[var(--border)]'
        }`}
      >
        <div
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            enabled ? 'translate-x-5.5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

export function KeyboardShortcutsSettings() {
  const { t } = useLocale();
  const {
    shortcuts,
    isHelpOpen,
    toggleShortcut,
    resetShortcuts,
    isShortcutEnabled,
    getShortcutsByScope,
    searchShortcuts,
    toggleHelp,
    DEFAULT_GLOBAL_SHORTCUTS,
    DEFAULT_EDITOR_SHORTCUTS,
  } = useShortcuts();

  const [searchQuery, setSearchQuery] = useState('');

  // 获取按作用域分组的快捷键
  const shortcutsByScope = useMemo(() => {
    if (searchQuery) {
      const filtered = searchShortcuts(searchQuery);
      return {
        global: filtered.filter(s => s.scope === 'global'),
        editor: filtered.filter(s => s.scope === 'editor'),
        settings: filtered.filter(s => s.scope === 'settings'),
      };
    }
    return getShortcutsByScope();
  }, [searchQuery, searchShortcuts, getShortcutsByScope]);

  // 渲染快捷键列表
  const renderShortcuts = (scope: ShortcutScope, shortcuts: Shortcut[]) => {
    if (shortcuts.length === 0) return null;

    return (
      <div key={scope} className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--fg)] flex items-center gap-2">
          <Keyboard size={18} className="text-[var(--accent-indigo)]" />
          {t(`shortcuts.scope.${scope}`)}
        </h3>
        <div className="space-y-2">
          {shortcuts.map(shortcut => (
            <ShortcutItem
              key={shortcut.id}
              shortcut={shortcut}
              enabled={isShortcutEnabled(shortcut.id)}
              onToggle={toggleShortcut}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 搜索框 */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
        <input
          type="text"
          placeholder={t('shortcuts.search')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-warm)] text-[var(--fg)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-indigo)]/20 focus:border-[var(--accent-indigo)]"
        />
      </div>

      {/* 快捷键列表 */}
      <div className="space-y-6">
        {renderShortcuts('global', shortcutsByScope.global)}
        {renderShortcuts('editor', shortcutsByScope.editor)}
        {shortcutsByScope.settings.length > 0 && renderShortcuts('settings', shortcutsByScope.settings)}
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
        <button
          onClick={toggleHelp}
          className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--accent-indigo)] hover:bg-[var(--accent-indigo)]/10 rounded-lg transition-colors"
        >
          <Keyboard size={16} />
          {t('shortcuts.showHelp')}
        </button>
        <button
          onClick={resetShortcuts}
          className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] rounded-lg transition-colors"
        >
          <RotateCcw size={16} />
          {t('shortcuts.reset')}
        </button>
      </div>
    </div>
  );
}

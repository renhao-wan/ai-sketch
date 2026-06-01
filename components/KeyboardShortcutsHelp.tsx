'use client';

import { useLocale } from '@/locales';
import { useShortcuts, formatKeys } from '@/hooks/useShortcuts';
import { X, Keyboard } from 'lucide-react';
import type { Shortcut, ShortcutScope } from '@/types/shortcuts';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  const { t } = useLocale();
  const { getShortcutsByScope, isShortcutEnabled } = useShortcuts();

  if (!isOpen) return null;

  const shortcutsByScope = getShortcutsByScope();

  const renderSection = (scope: ShortcutScope, shortcuts: Shortcut[]) => {
    if (shortcuts.length === 0) return null;

    return (
      <div key={scope} className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--fg)] flex items-center gap-2">
          <Keyboard size={18} className="text-[var(--accent-indigo)]" />
          {t(`shortcuts.scope.${scope}`)}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {shortcuts.map(shortcut => (
            <div
              key={shortcut.id}
              className={`flex items-center justify-between p-2.5 rounded-lg ${
                isShortcutEnabled(shortcut.id)
                  ? 'bg-[var(--surface-warm)]'
                  : 'bg-[var(--surface-warm)] opacity-50'
              }`}
            >
              <span className="text-sm text-[var(--fg)]">{shortcut.description}</span>
              <div className="flex gap-1">
                {shortcut.keys.map((key, index) => (
                  <kbd
                    key={index}
                    className="px-2 py-1 text-xs font-mono bg-[var(--surface-warm-hover)] border border-[var(--border)] rounded"
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
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--bg)] rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-indigo)]/10 flex items-center justify-center">
              <Keyboard size={20} className="text-[var(--accent-indigo)]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--fg)]">
                {t('shortcuts.title')}
              </h2>
              <p className="text-sm text-[var(--muted)]">
                {t('shortcuts.helpDescription')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)] space-y-6">
          {renderSection('global', shortcutsByScope.global)}
          {renderSection('editor', shortcutsByScope.editor)}
          {shortcutsByScope.settings.length > 0 && renderSection('settings', shortcutsByScope.settings)}
        </div>

        {/* 底部 */}
        <div className="flex justify-end p-4 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-[var(--accent-indigo)] text-white rounded-lg hover:bg-[var(--accent-indigo)]/90 transition-colors"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

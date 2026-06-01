'use client';

import { Palette, Wand2, MessageSquare, Database, Info, LucideIcon } from 'lucide-react';
import { useLocale } from '@/locales';
import type { TranslationKey } from '@/locales';

export type SettingsTab = 'appearance' | 'llm' | 'conversations' | 'data' | 'about';

interface SettingsSidebarProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

const tabs: { key: SettingsTab; icon: LucideIcon; labelKey: TranslationKey }[] = [
  { key: 'appearance', icon: Palette, labelKey: 'settings.appearance' },
  { key: 'llm', icon: Wand2, labelKey: 'settings.llm' },
  { key: 'conversations', icon: MessageSquare, labelKey: 'settings.conversations' },
  { key: 'data', icon: Database, labelKey: 'settings.data' },
  { key: 'about', icon: Info, labelKey: 'settings.about' },
];

export function SettingsSidebar({ activeTab, onTabChange }: SettingsSidebarProps) {
  const { t } = useLocale();

  return (
    <nav aria-label="Settings navigation" className="w-48 flex-shrink-0 border-r border-[var(--border)] bg-[var(--surface-warm)] p-3">
      <div className="space-y-1">
        {tabs.map(({ key, icon: Icon, labelKey }) => (
          <button
            key={key}
            onClick={() => onTabChange(key)}
            aria-current={activeTab === key ? 'page' : undefined}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
              ${activeTab === key
                ? 'bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)] border border-[var(--accent-indigo)]/20'
                : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] border border-transparent'
              }
            `}
          >
            <Icon size={16} />
            <span>{t(labelKey)}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

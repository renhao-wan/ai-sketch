'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, type TranslationKey } from '@/locales';
import { SettingsSidebar, SettingsTab } from '@/components/settings/SettingsSidebar';
import { AppearanceSettings } from '@/components/settings/AppearanceSettings';
import { LLMSettings } from '@/components/settings/LLMSettings';
import ConversationSettings from '@/components/settings/ConversationSettings';
import DataSettings from '@/components/settings/DataSettings';
import { KeyboardShortcutsSettings } from '@/components/settings/KeyboardShortcutsSettings';
import { AboutSettings } from '@/components/settings/AboutSettings';
import { KeyboardShortcutsHelp } from '@/components/KeyboardShortcutsHelp';
import { useShortcuts } from '@/hooks/useShortcuts';
import { ArrowLeft, Search } from 'lucide-react';

const VALID_TABS: SettingsTab[] = ['appearance', 'llm', 'conversations', 'data', 'shortcuts', 'about'];

const tabDescriptions: Record<SettingsTab, TranslationKey> = {
  appearance: 'settings.appearanceDesc',
  llm: 'settings.llmDesc',
  conversations: 'settings.conversationsTabDesc',
  data: 'settings.dataDesc',
  shortcuts: 'settings.shortcutsDesc',
  about: 'settings.aboutDesc',
};

export default function SettingsPage() {
  const { t } = useLocale();
  const router = useRouter();
  const { isHelpOpen, setIsHelpOpen } = useShortcuts();
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const [shortcutsSearchQuery, setShortcutsSearchQuery] = useState('');

  // Read tab from query parameter on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam && VALID_TABS.includes(tabParam as SettingsTab)) {
        setActiveTab(tabParam as SettingsTab);
      }
    }
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'appearance':
        return <AppearanceSettings />;
      case 'llm':
        return <LLMSettings />;
      case 'conversations':
        return <ConversationSettings />;
      case 'data':
        return <DataSettings />;
      case 'shortcuts':
        return <KeyboardShortcutsSettings searchQuery={shortcutsSearchQuery} />;
      case 'about':
        return <AboutSettings />;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[var(--bg)]">
      {/* 顶部导航 */}
      <header className="flex-shrink-0 backdrop-blur-xl bg-[var(--bg-glass)] border-b border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--fg)] transition-colors duration-200"
          >
            <ArrowLeft size={16} />
            <span>{t('settings.back')}</span>
          </button>
          <div className="w-px h-6 bg-[var(--border)]" />
          <h1 className="text-lg font-semibold text-[var(--fg)]">{t('settings.title')}</h1>
        </div>
      </header>

      {/* 主内容区 */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 py-8 h-full">
          <div className="flex gap-8 h-full">
            {/* 侧边栏 */}
            <SettingsSidebar activeTab={activeTab} onTabChange={setActiveTab} />

            {/* 内容区 */}
            <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
              <div className="mb-6 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-[var(--fg)]">
                      {t(`settings.${activeTab}`)}
                    </h2>
                    <p className="text-sm text-[var(--muted)] mt-1">
                      {t(tabDescriptions[activeTab])}
                    </p>
                  </div>
                  {activeTab === 'shortcuts' && (
                    <div className="relative w-64">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                      <input
                        type="text"
                        placeholder={t('shortcuts.search')}
                        value={shortcutsSearchQuery}
                        onChange={(e) => setShortcutsSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-warm)] text-[var(--fg)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-indigo)]/20 focus:border-[var(--accent-indigo)] text-sm"
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto pb-8 scrollbar-hide">
                {renderContent()}
              </div>
            </main>
          </div>
        </div>
      </div>

      {/* 快捷键帮助弹窗 */}
      <KeyboardShortcutsHelp
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, type TranslationKey } from '@/lib/locales';
import { useShortcuts } from '@/hooks/useShortcuts';
import { SettingsSidebar, SettingsTab } from '@/components/settings/SettingsSidebar';
import { AppearanceSettings } from '@/components/settings/AppearanceSettings';
import { LLMSettings } from '@/components/settings/LLMSettings';
import { NetworkSettings } from '@/components/settings/NetworkSettings';
import ConversationSettings from '@/components/settings/ConversationSettings';
import DataSettings from '@/components/settings/DataSettings';
import { KeyboardShortcutsSettings } from '@/components/settings/KeyboardShortcutsSettings';
import { AboutSettings } from '@/components/settings/AboutSettings';
import { Search } from 'lucide-react';
import WindowControls from '@/components/layout/WindowControls';
import { AppIcon } from '@/components/layout/TopBar';
import Tooltip from '@/components/ui/Tooltip';

const VALID_TABS: SettingsTab[] = ['appearance', 'llm', 'network', 'conversations', 'data', 'shortcuts', 'about'];

const tabDescriptions: Record<SettingsTab, TranslationKey> = {
  appearance: 'settings.appearanceDesc',
  llm: 'settings.llmDesc',
  network: 'settings.networkDesc',
  conversations: 'settings.conversationsTabDesc',
  data: 'settings.dataDesc',
  shortcuts: 'settings.shortcutsDesc',
  about: 'settings.aboutDesc',
};

export default function SettingsPage() {
  const { t } = useLocale();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const [shortcutsSearchQuery, setShortcutsSearchQuery] = useState('');

  // 注册快捷键
  useShortcuts({
    onGoHome: () => router.push('/'),
    onNewConversation: () => router.push('/editor'),
    onOpenSettings: (tab) => {
      if (tab) {
        setActiveTab(tab as SettingsTab);
      }
    },
  });

  // Read tab from query parameter on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam && VALID_TABS.includes(tabParam as SettingsTab)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- 从 URL 参数初始化 tab，仅执行一次
        setActiveTab(tabParam as SettingsTab);
      }
    }
  }, []);

  /** Tab → 组件映射，所有 Tab 同时挂载，用 display 控制显隐避免切换时卸载/重挂导致闪烁 */
  const tabs: { key: SettingsTab; component: React.ReactNode }[] = [
    { key: 'appearance', component: <AppearanceSettings /> },
    { key: 'llm', component: <LLMSettings /> },
    { key: 'network', component: <NetworkSettings /> },
    { key: 'conversations', component: <ConversationSettings /> },
    { key: 'data', component: <DataSettings /> },
    { key: 'shortcuts', component: <KeyboardShortcutsSettings searchQuery={shortcutsSearchQuery} /> },
    { key: 'about', component: <AboutSettings /> },
  ];

  return (
    <div className="h-screen flex flex-col bg-[var(--bg)]">
      {/* 顶部导航 */}
      <header
        className="flex-shrink-0 backdrop-blur-xl bg-[var(--bg-glass)] border-b border-[var(--border)]"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Tooltip content={t('copilot.backHome')} side="bottom">
              <button
                onClick={() => router.push('/')}
                className="hover:opacity-80 transition-opacity duration-200 relative"
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-indigo)] to-[var(--accent-violet)] rounded-lg blur-md opacity-20" />
                <div className="relative"><AppIcon size={22} /></div>
              </button>
            </Tooltip>
            <div className="w-px h-6 bg-[var(--border)]" />
            <span className="text-[13px] font-semibold tracking-tight text-[var(--fg)]">{t('settings.title')}</span>
          </div>
          <div
            className="flex items-center gap-1"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <WindowControls />
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 py-8 h-full">
          <div className="flex gap-8 h-full">
            {/* 侧边栏 */}
            <SettingsSidebar activeTab={activeTab} onTabChange={setActiveTab} />

            {/* 内容区 */}
            <main className="flex-1 min-w-0 flex flex-col overflow-y-auto">
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
                        className="w-full pl-10 pr-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-warm)] text-[var(--fg)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-indigo)]/20 focus:border-[var(--accent-indigo)] hover:border-[var(--accent-indigo)]/20 text-sm transition-all duration-200"
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto pb-8 scrollbar-hide">
                {tabs.map(tab => (
                  <div key={tab.key} className="h-full" style={{ display: activeTab === tab.key ? undefined : 'none' }}>
                    {tab.component}
                  </div>
                ))}
              </div>
            </main>
          </div>
        </div>
      </div>

    </div>
  );
}

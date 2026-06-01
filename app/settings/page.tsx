'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, type TranslationKey } from '@/locales';
import { SettingsSidebar, SettingsTab } from '@/components/settings/SettingsSidebar';
import { AppearanceSettings } from '@/components/settings/AppearanceSettings';
import { LLMSettings } from '@/components/settings/LLMSettings';
import DataSettings from '@/components/settings/DataSettings';
import { ArrowLeft } from 'lucide-react';

const tabDescriptions: Record<SettingsTab, TranslationKey> = {
  appearance: 'settings.appearanceDesc',
  llm: 'settings.llmDesc',
  data: 'settings.dataDesc',
};

export default function SettingsPage() {
  const { t } = useLocale();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');

  const renderContent = () => {
    switch (activeTab) {
      case 'appearance':
        return <AppearanceSettings />;
      case 'llm':
        return <LLMSettings />;
      case 'data':
        return <DataSettings />;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-[var(--bg-glass)] border-b border-[var(--border)]">
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
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex gap-8">
          {/* 侧边栏 */}
          <SettingsSidebar activeTab={activeTab} onTabChange={setActiveTab} />

          {/* 内容区 */}
          <main className="flex-1 min-w-0">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-[var(--fg)]">
                {t(`settings.${activeTab}`)}
              </h2>
              <p className="text-sm text-[var(--muted)] mt-1">
                {t(tabDescriptions[activeTab])}
              </p>
            </div>
            {renderContent()}
          </main>
        </div>
      </div>
    </div>
  );
}

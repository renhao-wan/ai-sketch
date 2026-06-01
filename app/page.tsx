'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppIcon } from '@/components/layout/TopBar';
import { setInitData } from '@/lib/init-data';
import AIPromptBox from '@/components/ai/AIPromptBox';
import ConfigManager from '@/components/dialogs/ConfigManager';
import HistoryModal from '@/components/dialogs/HistoryModal';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useLocale } from '@/locales';
import { timeAgo } from '@/lib/time-ago';
import { Settings, Wand2, History, FileText, PenTool } from 'lucide-react';
import * as api from '@/lib/api-client';
import { runMigrationIfNeeded } from '@/lib/migration';
import Tooltip from '@/components/ui/Tooltip';
import type { Conversation } from '@/types';

export default function HomePage() {
  const router = useRouter();
  const { t } = useLocale();
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [recentItems, setRecentItems] = useState<Conversation[]>([]);

  useEffect(() => {
    runMigrationIfNeeded().then(async () => {
      try {
        const { conversations } = await api.fetchConversations({ limit: 5 });
        setRecentItems(conversations);
      } catch (err) {
        console.error('Failed to load conversations:', err);
      }
    });
  }, []);

  const handleApplyConversation = (item: Conversation) => {
    sessionStorage.setItem('ai-sketch-load-conversation', item.id);
    router.push('/editor');
  };

  return (
    <div className="h-screen flex flex-col bg-[var(--bg)] noise-overlay">
      {/* Header */}
      <header className="h-12 flex items-center justify-between px-5 backdrop-blur-xl bg-[var(--bg-glass)] border-b border-black/[0.06] flex-shrink-0 select-none">
        <div className="flex items-center gap-2.5">
          <AppIcon size={26} />
          <span className="text-[13px] font-semibold tracking-tight text-[var(--fg)]">AI Sketch</span>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip content={t('home.enterEditor')} side="bottom">
            <button
              onClick={() => router.push('/editor')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--accent-indigo)] bg-[var(--accent-indigo)]/5 hover:bg-[var(--accent-indigo)]/10 rounded-lg transition-colors duration-150"
            >
              <PenTool size={13} />
              <span>{t('home.editor')}</span>
            </button>
          </Tooltip>
          <LanguageSwitcher />
          <Tooltip content={t('home.history')} side="bottom">
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-colors duration-150"
            >
              <History size={15} />
            </button>
          </Tooltip>
          <Tooltip content={t('config.title')} side="bottom">
            <button
              onClick={() => setIsConfigOpen(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-colors duration-150"
            >
              <Wand2 size={15} />
            </button>
          </Tooltip>
          <Tooltip content={t('home.settings')} side="bottom">
            <button
              onClick={() => router.push('/settings')}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-colors duration-150"
            >
              <Settings size={15} />
            </button>
          </Tooltip>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center relative overflow-hidden">
        {/* Background orbs */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="blur-orb blur-orb-indigo" style={{ width: '600px', height: '600px', top: '-5%', left: '-8%' }} />
          <div className="blur-orb blur-orb-violet" style={{ width: '500px', height: '500px', top: '25%', right: '-6%', animationDelay: '-7s' }} />
          <div className="blur-orb blur-orb-cyan" style={{ width: '400px', height: '400px', bottom: '0%', left: '30%', animationDelay: '-13s' }} />
        </div>

        <div className="relative z-10 w-full max-w-4xl px-6">
          {/* Top: Icon + Title */}
          <div className="text-center mb-10 stagger-children">
            <div className="flex justify-center mb-5">
              <div className="relative">
                <AppIcon size={52} />
                <div className="absolute inset-0 rounded-[14px] bg-gradient-to-br from-[var(--accent-indigo)] to-[var(--accent-violet)] opacity-20 blur-xl scale-150" />
              </div>
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-[var(--fg)] leading-[1.1] mb-3">
              {t('home.hero.line1')}
              <br />
              <span className="bg-gradient-to-r from-[var(--accent-indigo)] via-[var(--accent-violet)] to-[var(--accent-cyan)] bg-clip-text text-transparent">
                {t('home.hero.line2')}
              </span>
            </h1>
            <p className="text-base text-[var(--muted)] max-w-lg mx-auto leading-relaxed">
              {t('home.hero.subtitle')}
            </p>
          </div>

          {/* Prompt Box */}
          <div className="mb-6">
            <AIPromptBox />
          </div>

          {/* Quick Templates */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
            {[
              { key: 'home.template.microservice', label: t('home.template.microservice') },
              { key: 'home.template.login', label: t('home.template.login') },
              { key: 'home.template.er', label: t('home.template.er') },
              { key: 'home.template.deploy', label: t('home.template.deploy') },
              { key: 'home.template.mindmap', label: t('home.template.mindmap') },
            ].map((tpl) => (
              <button
                key={tpl.key}
                onClick={() => {
                  setInitData({ type: 'text', data: tpl.label, format: 'excalidraw' });
                  router.push('/editor?source=text');
                }}
                className="px-4 py-2 text-xs text-[var(--muted)] bg-[var(--bg-glass)] backdrop-blur border border-[var(--border)] rounded-full hover:bg-[var(--card)] hover:text-[var(--fg)] hover:border-[var(--accent-indigo)]/20 transition-all duration-200"
              >
                {tpl.label}
              </button>
            ))}
          </div>

          {/* Recent Items */}
          {recentItems.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="text-[11px] text-[var(--muted)]/50 mr-1">{t('home.recent')}</span>
              {recentItems.slice(0, 3).map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleApplyConversation(item)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-[var(--muted)] bg-[var(--bg-glass)]/50 backdrop-blur border border-[var(--border)]/50 rounded-full hover:bg-[var(--bg-glass)] hover:text-[var(--fg)] transition-all duration-200"
                >
                  <FileText size={11} className="text-[var(--accent-indigo)]/50" />
                  <span className="max-w-[120px] truncate">{item.title}</span>
                  <span className="text-[var(--muted)]/40">{timeAgo(item.updatedAt, t)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <ConfigManager isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} onConfigSelect={() => {}} />
      <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} onApply={handleApplyConversation} />
    </div>
  );
}

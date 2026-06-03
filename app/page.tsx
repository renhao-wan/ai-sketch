'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppIcon } from '@/components/layout/TopBar';
import { setInitData } from '@/lib/utils/init-data';
import AIPromptBox from '@/components/ai/AIPromptBox';
import HistoryModal from '@/components/dialogs/HistoryModal';
import { useLocale } from '@/lib/locales';
import { useShortcuts } from '@/hooks/useShortcuts';
import { timeAgo } from '@/lib/utils/time-ago';
import { Settings, History, FileText, PenTool } from 'lucide-react';
import * as api from '@/lib/api/client';
import Tooltip from '@/components/ui/Tooltip';
import WindowControls from '@/components/layout/WindowControls';
import type { Conversation } from '@/lib/types';

export default function HomePage() {
  const router = useRouter();
  const { t } = useLocale();
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [recentItems, setRecentItems] = useState<Conversation[]>([]);

  // 注册快捷键
  useShortcuts({
    onGoHome: () => router.push('/'),
    onNewConversation: () => router.push('/editor'),
    onOpenHistory: () => setIsHistoryOpen(true),
    onOpenSettings: (tab) => router.push(tab ? `/settings?tab=${tab}` : '/settings'),
  });

  useEffect(() => {
    api.fetchConversations({ limit: 5 })
      .then(({ conversations }) => setRecentItems(conversations))
      .catch((err) => console.error('Failed to load conversations:', err));
  }, []);

  const handleApplyConversation = (item: Conversation) => {
    sessionStorage.setItem('ai-sketch-load-conversation', item.id);
    router.push('/editor');
  };

  return (
    <div className="h-screen flex flex-col bg-[var(--bg)] noise-overlay">
      {/* Header - 可拖拽区域 */}
      <header
        className="h-14 flex items-center justify-between px-6 backdrop-blur-xl bg-[var(--bg-glass)] border-b border-[var(--border)] flex-shrink-0 select-none"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-2.5">
          <AppIcon size={22} />
          <span className="text-[12px] font-semibold tracking-tight text-[var(--fg)]">AI Sketch</span>
        </div>
        <div
          className="flex items-center gap-1"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <Tooltip content={t('home.enterEditor')} side="bottom">
            <button
              onClick={() => router.push('/editor')}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-[var(--accent-indigo)] bg-[var(--accent-indigo)]/5 hover:bg-[var(--accent-indigo)]/10 rounded-lg transition-colors duration-150"
            >
              <PenTool size={13} />
              <span>{t('home.editor')}</span>
            </button>
          </Tooltip>
          <Tooltip content={t('home.history')} side="bottom">
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-colors duration-150"
            >
              <History size={15} />
            </button>
          </Tooltip>
          <Tooltip content={t('home.settings')} side="bottom">
            <button
              onClick={() => router.push('/settings')}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-colors duration-150"
            >
              <Settings size={15} />
            </button>
          </Tooltip>
          <WindowControls />
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center relative overflow-hidden">
        <div className="relative z-10 w-full max-w-4xl px-6">
          {/* Top: Icon + Title */}
          <div className="text-center mb-10">
            <div className="flex justify-center mb-5">
              <div className="relative">
                <AppIcon size={52} />
                <div className="absolute inset-0 rounded-[14px] bg-gradient-to-br from-[var(--accent-indigo)] to-[var(--accent-violet)] opacity-10 blur-xl scale-150" />
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
                className="px-4 py-2 text-xs text-[var(--muted)] bg-[var(--bg-glass)] backdrop-blur border border-[var(--border)] rounded-full hover:bg-[var(--card)] hover:text-[var(--fg)] hover:border-[var(--accent-indigo)]/40 transition-all duration-200"
              >
                {tpl.label}
              </button>
            ))}
          </div>

          {/* Recent Items — 固定高度容器，避免数据加载后布局跳动 */}
          <div className="h-9 flex flex-wrap items-center justify-center gap-2">
            {recentItems.length > 0 && (
              <>
                <span className="text-[11px] text-[var(--muted)]/50 mr-1">{t('home.recent')}</span>
                {recentItems.slice(0, 3).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleApplyConversation(item)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-[var(--muted)] bg-[var(--bg-glass)]/50 backdrop-blur border border-[var(--border)]/50 rounded-full hover:bg-[var(--card)] hover:text-[var(--fg)] hover:border-[var(--accent-indigo)]/30 transition-all duration-200"
                  >
                    <FileText size={11} className="text-[var(--accent-indigo)]/50" />
                    <span className="max-w-[120px] truncate">{item.title}</span>
                    <span className="text-[var(--muted)]/40">{timeAgo(item.updatedAt, t)}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      </main>

      {/* Modals */}
      <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} onApply={handleApplyConversation} />
    </div>
  );
}

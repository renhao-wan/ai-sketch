'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppIcon } from '@/components/TopBar';
import AIPromptBox from '@/components/AIPromptBox';
import ConfigManager from '@/components/ConfigManager';
import HistoryModal from '@/components/HistoryModal';
import { Settings, History, FileText } from 'lucide-react';
import { historyManager } from '@/lib/history-manager';
import type { HistoryItem } from '@/types';

const CHART_TYPE_NAMES: Record<string, string> = {
  auto: '自动', flowchart: '流程图', mindmap: '思维导图', orgchart: '组织架构图',
  sequence: '时序图', class: 'UML类图', er: 'ER图', gantt: '甘特图',
  architecture: '架构图', state: '状态图', network: '网络拓扑图',
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  return `${Math.floor(diff / 86400000)} 天前`;
}

export default function HomePage() {
  const router = useRouter();
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [recentItems, setRecentItems] = useState<HistoryItem[]>([]);

  useEffect(() => {
    historyManager.ensureLoaded();
    setRecentItems(historyManager.getHistories().slice(0, 5));
  }, []);

  const handleApplyHistory = (item: HistoryItem) => {
    router.push(`/editor?prompt=${encodeURIComponent(item.userInput)}&format=${item.chartType}`);
  };

  return (
    <div className="h-screen flex flex-col bg-[var(--bg)] noise-overlay">
      {/* Header */}
      <header className="h-12 flex items-center justify-between px-5 backdrop-blur-xl bg-white/70 border-b border-black/[0.06] flex-shrink-0 select-none">
        <div className="flex items-center gap-2.5">
          <AppIcon size={26} />
          <span className="text-[13px] font-semibold tracking-tight text-[var(--fg)]">AI Sketch</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/[0.05] transition-colors duration-150"
            title="历史记录"
          >
            <History size={15} />
          </button>
          <button
            onClick={() => setIsConfigOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/[0.05] transition-colors duration-150"
            title="设置"
          >
            <Settings size={15} />
          </button>
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
              用自然语言
              <br />
              <span className="bg-gradient-to-r from-[var(--accent-indigo)] via-[var(--accent-violet)] to-[var(--accent-cyan)] bg-clip-text text-transparent">
                设计图表
              </span>
            </h1>
            <p className="text-base text-[var(--muted)] max-w-lg mx-auto leading-relaxed">
              描述你的想法，AI 即时生成专业图表
            </p>
          </div>

          {/* Prompt Box */}
          <div className="mb-6">
            <AIPromptBox />
          </div>

          {/* Quick Templates */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
            {['微服务架构图', '用户登录流程', 'ER 数据模型', '系统部署图', '思维导图'].map((t) => (
              <a
                key={t}
                href={`/editor?prompt=${encodeURIComponent(t)}&format=auto`}
                className="px-4 py-2 text-xs text-[var(--muted)] bg-white/50 backdrop-blur border border-white/20 rounded-full hover:bg-white/70 hover:text-[var(--fg)] hover:border-[var(--accent-indigo)]/20 transition-all duration-200"
              >
                {t}
              </a>
            ))}
          </div>

          {/* Recent Items */}
          {recentItems.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="text-[11px] text-[var(--muted)]/50 mr-1">最近</span>
              {recentItems.slice(0, 3).map((item) => {
                const label = typeof item.userInput === 'object' ? ((item.userInput as { text?: string }).text || '图片生成') : item.userInput;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleApplyHistory(item)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-[var(--muted)] bg-white/30 backdrop-blur border border-white/15 rounded-full hover:bg-white/50 hover:text-[var(--fg)] transition-all duration-200"
                  >
                    <FileText size={11} className="text-[var(--accent-indigo)]/50" />
                    <span className="max-w-[120px] truncate">{label}</span>
                    <span className="text-[var(--muted)]/40">{timeAgo(item.timestamp)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <ConfigManager isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} onConfigSelect={() => {}} />
      <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} onApply={handleApplyHistory} />
    </div>
  );
}

'use client';

import { useState, type ReactNode, type MouseEvent } from 'react';
import { ChevronDown, ChevronUp, Code2, Sparkles, GitCompare, Terminal } from 'lucide-react';
import { useLocale } from '@/locales';
import type { TranslationKey } from '@/locales';

const TABS: { id: string; labelKey: TranslationKey; icon: typeof Code2 }[] = [
  { id: 'code', labelKey: 'panel.generatedCode', icon: Code2 },
  { id: 'ai', labelKey: 'panel.aiExplanation', icon: Sparkles },
  { id: 'diff', labelKey: 'panel.versionCompare', icon: GitCompare },
  { id: 'logs', labelKey: 'panel.logs', icon: Terminal },
];

interface BottomContextPanelProps {
  generatedCode?: string;
  children?: ReactNode;
}

export default function BottomContextPanel({ generatedCode, children }: BottomContextPanelProps) {
  const { t } = useLocale();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState('code');
  const [height, setHeight] = useState(180);
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = (e: MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = height;

    const onMouseMove = (e: globalThis.MouseEvent) => {
      const delta = startY - e.clientY;
      setHeight(Math.min(Math.max(startHeight + delta, 100), 400));
    };

    const onMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  if (isCollapsed) {
    return (
      <div className="flex-shrink-0 border-t border-black/[0.06] bg-[var(--bg-glass)] backdrop-blur-xl">
        <button
          onClick={() => setIsCollapsed(false)}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-xs text-[var(--muted)] hover:text-[var(--fg)] transition-all duration-200 hover:bg-[var(--surface-warm-hover)]"
        >
          <ChevronUp size={14} />
          <span>{t('panel.expandPanel')}</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex-shrink-0 border-t border-black/[0.06] bg-[var(--bg-glass)] backdrop-blur-xl flex flex-col"
      style={{ height: `${height}px` }}
    >
      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className="h-1.5 cursor-row-resize hover:bg-gradient-to-r hover:from-[var(--accent-indigo)]/20 hover:via-[var(--accent-violet)]/20 hover:to-[var(--accent-cyan)]/20 transition-all duration-300 flex-shrink-0 group"
      >
        <div className="w-8 h-0.5 bg-black/10 rounded-full mx-auto mt-0.5 group-hover:bg-[var(--accent-indigo)]/40 transition-colors duration-200" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 h-10 flex-shrink-0">
        <div className="flex items-center gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-[var(--accent-indigo)]/8 text-[var(--accent-indigo)] shadow-sm'
                  : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)]'
              }`}
            >
              <tab.icon size={13} />
              <span>{t(tab.labelKey)}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200"
        >
          <ChevronDown size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 pb-3 scrollbar-thin">
        {activeTab === 'code' && children ? (
          children
        ) : activeTab === 'code' && generatedCode ? (
          <pre className="text-xs font-mono text-[var(--fg)]/80 whitespace-pre-wrap break-words">
            {generatedCode}
          </pre>
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-[var(--muted)]/50">
            {activeTab === 'ai' && t('panel.aiExplanationEmpty')}
            {activeTab === 'diff' && t('panel.versionCompareSoon')}
            {activeTab === 'logs' && t('panel.noLogs')}
            {activeTab === 'code' && t('panel.codeWillAppear')}
          </div>
        )}
      </div>
    </div>
  );
}

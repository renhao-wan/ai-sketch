'use client';

import { useState, useEffect, useRef, useCallback, type ReactNode, type MouseEvent } from 'react';
import { ChevronDown, ChevronUp, Code2, Sparkles, Copy, Download, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import { useLocale } from '@/locales';
import type { TranslationKey } from '@/locales';

import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github-dark.min.css';

const TABS: { id: string; labelKey: TranslationKey; icon: typeof Code2 }[] = [
  { id: 'code', labelKey: 'panel.generatedCode', icon: Code2 },
  { id: 'explain', labelKey: 'aiAction.explain', icon: Sparkles },
];

interface BottomContextPanelProps {
  generatedCode?: string;
  children?: ReactNode;
  explanation?: string;
  format?: string;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export default function BottomContextPanel({
  generatedCode,
  children,
  explanation,
  format,
  activeTab: controlledTab,
  onTabChange,
}: BottomContextPanelProps) {
  const { t } = useLocale();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [internalTab, setInternalTab] = useState('code');
  const [height, setHeight] = useState(180);
  const [isResizing, setIsResizing] = useState(false);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(() => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1500);
  }, [generatedCode]);

  const handleExport = useCallback(() => {
    if (!generatedCode) return;
    const ext = format === 'excalidraw' ? 'json' : format === 'mermaid' ? 'mmd' : 'drawio';
    const blob = new Blob([generatedCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagram.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [generatedCode, format]);

  const activeTab = controlledTab ?? internalTab;

  const handleTabChange = (tab: string) => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      setInternalTab(tab);
    }
  };

  const handleMouseDown = (e: MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = height;

    const onMouseMove = (e: globalThis.MouseEvent) => {
      const delta = startY - e.clientY;
      const maxHeight = window.innerHeight * 0.4;
      setHeight(Math.min(Math.max(startHeight + delta, 100), maxHeight));
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
              onClick={() => handleTabChange(tab.id)}
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
        <div className="flex items-center gap-0.5">
          {activeTab === 'code' && generatedCode && (
            <>
              <button
                onClick={handleCopy}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200"
                title={t('copilot.copy')}
              >
                {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
              </button>
              <button
                onClick={handleExport}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200"
                title={t('copilot.export')}
              >
                <Download size={13} />
              </button>
            </>
          )}
          <button
            onClick={() => setIsCollapsed(true)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200"
          >
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 pb-3 scrollbar-thin">
        {activeTab === 'code' && children ? (
          children
        ) : activeTab === 'code' && generatedCode ? (
          <pre className="text-xs font-mono text-[var(--fg)]/80 whitespace-pre-wrap break-words">
            {generatedCode}
          </pre>
        ) : activeTab === 'explain' && explanation ? (
          <div className="prose prose-sm max-w-none text-[var(--fg)]/80
            prose-headings:text-[var(--fg)] prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1.5
            prose-h1:text-base prose-h2:text-sm prose-h3:text-xs
            prose-p:my-1 prose-p:leading-relaxed
            prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5
            prose-code:bg-[var(--surface-warm-hover)] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono
            prose-pre:bg-[var(--surface-warm-hover)] prose-pre:rounded-lg prose-pre:p-3 prose-pre:my-2
            prose-blockquote:border-l-2 prose-blockquote:border-[var(--accent-indigo)] prose-blockquote:pl-3 prose-blockquote:my-2 prose-blockquote:text-[var(--muted)]
            prose-strong:text-[var(--fg)] prose-strong:font-semibold
            prose-a:text-[var(--accent-indigo)] prose-a:underline
            prose-hr:my-3 prose-hr:border-[var(--border)]
            prose-table:border-collapse prose-table:w-full prose-table:my-2
            prose-th:border prose-th:border-[var(--border)] prose-th:px-2 prose-th:py-1.5 prose-th:bg-[var(--surface-warm-hover)] prose-th:text-xs prose-th:font-semibold prose-th:text-left
            prose-td:border prose-td:border-[var(--border)] prose-td:px-2 prose-td:py-1.5 prose-td:text-xs
          ">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
              rehypePlugins={[rehypeKatex, rehypeHighlight]}
            >{explanation}</ReactMarkdown>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-[var(--muted)]/50">
            {activeTab === 'code' && t('panel.codeWillAppear')}
            {activeTab === 'explain' && t('aiAction.noCode')}
          </div>
        )}
      </div>
    </div>
  );
}

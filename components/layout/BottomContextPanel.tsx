'use client';

import { useState, useRef, useCallback, type ReactNode, type MouseEvent } from 'react';
import { ChevronDown, ChevronUp, Code2, Sparkles, Copy, Download, Check } from 'lucide-react';
import { useLocale } from '@/locales';
import type { TranslationKey } from '@/locales';

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

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 pb-3 scrollbar-thin relative">
        {activeTab === 'code' && children ? (
          children
        ) : activeTab === 'code' && generatedCode ? (
          <>
            <div className="flex items-center justify-end gap-0.5 mb-1">
              <button
                onClick={handleCopy}
                className="w-6 h-6 flex items-center justify-center rounded text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200"
                title={t('copilot.copy')}
              >
                {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
              </button>
              <button
                onClick={handleExport}
                className="w-6 h-6 flex items-center justify-center rounded text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200"
                title={t('copilot.export')}
              >
                <Download size={12} />
              </button>
            </div>
            <pre className="text-xs font-mono text-[var(--fg)]/80 whitespace-pre-wrap break-words">
              {generatedCode}
            </pre>
          </>
        ) : activeTab === 'explain' && explanation ? (
          <div className="text-sm text-[var(--fg)]/80 whitespace-pre-wrap break-words leading-relaxed">
            {explanation}
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

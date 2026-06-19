'use client';

import { useState, useEffect, useRef, useCallback, type ReactNode, type MouseEvent } from 'react';
import { ChevronDown, ChevronUp, Code2, Copy, Download, Check, Image, FileCode, FileText, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import { useLocale } from '@/lib/locales';
import Tooltip from '@/components/ui/Tooltip';
import type { ExportFormat } from '@/lib/utils/export-diagram';

import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github.min.css';

// 动态 Tab 接口
export interface DynamicTab {
  id: string;
  label: string;
  icon: string;
  content: string;
  type: 'code' | 'text';
  timestamp: number;
}

// 获取图标组件
const getIconComponent = (iconName: string) => {
  const iconMap: Record<string, typeof Code2> = {
    Code2, Sparkles: Code2, // 简化处理，实际需要导入所有图标
  };
  return iconMap[iconName] || Code2;
};

// 可用操作接口
interface AvailableAction {
  id: string;
  label: string;
  icon: string;
  type: 'builtin' | 'custom';
  actionType: 'modify' | 'explain';
}

interface BottomContextPanelProps {
  generatedCode?: string;
  children?: ReactNode;
  format?: string;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onExportAs?: (format: ExportFormat) => void;
  dynamicTabs?: DynamicTab[];
  onRemoveTab?: (tabId: string) => void;
  availableActions?: AvailableAction[];
}

export default function BottomContextPanel({
  generatedCode,
  children,
  format,
  activeTab: controlledTab,
  onTabChange,
  onExportAs,
  dynamicTabs = [],
  onRemoveTab,
  availableActions = [],
}: BottomContextPanelProps) {
  const { t } = useLocale();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [internalTab, setInternalTab] = useState('code');
  const [height, setHeight] = useState(180);
  const [isResizing, setIsResizing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const activeTab = controlledTab ?? internalTab;

  // 获取当前 tab 的内容
  const getCurrentContent = useCallback(() => {
    if (activeTab === 'code') {
      return generatedCode || '';
    }
    // 查找动态 tab 的内容
    const dynamicTab = dynamicTabs.find(tab => tab.id === activeTab);
    return dynamicTab?.content || '';
  }, [activeTab, generatedCode, dynamicTabs]);

  // 获取当前操作的信息
  const getCurrentActionInfo = useCallback(() => {
    if (activeTab === 'code') {
      return null;
    }
    // 从 activeTab 中提取操作 ID
    const actionId = activeTab.replace('action-', '');
    return availableActions.find(action => action.id === actionId) || null;
  }, [activeTab, availableActions]);

  // 获取当前 tab 的类型
  const getCurrentTabType = useCallback(() => {
    if (activeTab === 'code') {
      return 'code';
    }
    const dynamicTab = dynamicTabs.find(tab => tab.id === activeTab);
    return dynamicTab?.type || 'text';
  }, [activeTab, dynamicTabs]);

  const handleCopy = useCallback(() => {
    const text = getCurrentContent();
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1500);
  }, [getCurrentContent]);

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

  /** 导出文本内容为 Markdown 文件 */
  const handleExportMd = useCallback(() => {
    const content = getCurrentContent();
    if (!content) return;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTab}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [getCurrentContent, activeTab]);

  /** 导出文本内容为 PDF 文件 */
  const [exportingPdf, setExportingPdf] = useState(false);

  const handleExportPdf = useCallback(async () => {
    const content = getCurrentContent();
    if (!content || exportingPdf) return;
    setExportingPdf(true);
    try {
      const { exportMarkdownToPdf } = await import('@/lib/utils/export-pdf');
      await exportMarkdownToPdf(content);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setExportingPdf(false);
    }
  }, [getCurrentContent, exportingPdf]);

  // 点击外部关闭导出菜单
  useEffect(() => {
    if (!showExportMenu) return;
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu]);

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

  const currentContent = getCurrentContent();
  const currentTabType = getCurrentTabType();

  return (
    <div
      className="flex-shrink-0 border-t border-black/[0.06] bg-[var(--bg-glass)] backdrop-blur-xl flex flex-col relative z-20"
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
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {/* 固定的代码 Tab */}
          <button
            onClick={() => handleTabChange('code')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 whitespace-nowrap ${
              activeTab === 'code'
                ? 'bg-[var(--accent-indigo)]/8 text-[var(--accent-indigo)] shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)]'
            }`}
          >
            <Code2 size={13} />
            <span>{t('panel.generatedCode')}</span>
          </button>

          {/* 可用操作的 Tab（预先显示） */}
          {availableActions
            .filter(action => action.actionType === 'explain')
            .map((action) => {
              const hasContent = dynamicTabs.some(tab => tab.id === `action-${action.id}`);
              return (
                <button
                  key={action.id}
                  onClick={() => handleTabChange(`action-${action.id}`)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 whitespace-nowrap ${
                    activeTab === `action-${action.id}`
                      ? 'bg-[var(--accent-indigo)]/8 text-[var(--accent-indigo)] shadow-sm'
                      : hasContent
                        ? 'text-[var(--fg)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)]'
                        : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)]'
                  }`}
                >
                  <Code2 size={13} />
                  <span>{action.label}</span>
                </button>
              );
            })}

          {/* 动态 Tab（已有内容的操作） */}
          {dynamicTabs.map((tab) => (
            <div key={tab.id} className="flex items-center group/tab">
              <button
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-[var(--accent-indigo)]/8 text-[var(--accent-indigo)] shadow-sm'
                    : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)]'
                }`}
              >
                <Code2 size={13} />
                <span>{tab.label}</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveTab?.(tab.id);
                }}
                className="w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover/tab:opacity-100 text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          {currentContent && (
            <>
              <Tooltip content={t('copilot.copy')} side="top">
                <button
                  onClick={handleCopy}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200"
                >
                  {copied ? <Check size={13} className="text-[var(--accent-indigo)]" /> : <Copy size={13} />}
                </button>
              </Tooltip>
              <div className="relative" ref={exportMenuRef}>
                <Tooltip content={t('copilot.export')} side="top">
                  <button
                    id="onboarding-export"
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200"
                  >
                    <Download size={13} />
                  </button>
                </Tooltip>
                {showExportMenu && (
                  <div className="absolute bottom-full right-0 mb-1 w-44 bg-[var(--surface-warm-solid)] rounded-xl border border-[var(--border)] shadow-[0_10px_40px_rgba(28,25,23,0.15)] overflow-hidden animate-slide-up" style={{ zIndex: 9999 }}>
                    {currentTabType === 'code' ? (
                      <>
                        <button
                          onClick={() => { onExportAs?.('png'); setShowExportMenu(false); }}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-[var(--fg)] hover:bg-[var(--accent-indigo)]/5 transition-colors"
                        >
                          <Image size={14} className="text-[var(--muted)]" />
                          {t('export.png')}
                        </button>
                        <button
                          onClick={() => { onExportAs?.('svg'); setShowExportMenu(false); }}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-[var(--fg)] hover:bg-[var(--accent-indigo)]/5 transition-colors"
                        >
                          <FileCode size={14} className="text-[var(--muted)]" />
                          {t('export.svg')}
                        </button>
                        <button
                          onClick={() => { onExportAs?.('code'); setShowExportMenu(false); }}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-[var(--fg)] hover:bg-[var(--accent-indigo)]/5 transition-colors border-t border-[var(--border)]"
                        >
                          <Code2 size={14} className="text-[var(--muted)]" />
                          {t('export.code')}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => { handleExportPdf(); setShowExportMenu(false); }}
                          disabled={exportingPdf}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-[var(--fg)] hover:bg-[var(--accent-indigo)]/5 transition-colors disabled:opacity-50"
                        >
                          <FileText size={14} className="text-[var(--muted)]" />
                          {exportingPdf ? '...' : t('export.pdf')}
                        </button>
                        <button
                          onClick={() => { handleExportMd(); setShowExportMenu(false); }}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-[var(--fg)] hover:bg-[var(--accent-indigo)]/5 transition-colors"
                        >
                          <FileCode size={14} className="text-[var(--muted)]" />
                          {t('export.md')}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
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
      <div className={`flex-1 px-4 pb-3 ${activeTab === 'code' ? 'overflow-hidden' : 'overflow-auto scrollbar-thin'}`}>
        {activeTab === 'code' && children ? (
          children
        ) : activeTab === 'code' && generatedCode ? (
          <pre className="text-xs font-mono text-[var(--fg)]/80 whitespace-pre-wrap break-words">
            {generatedCode}
          </pre>
        ) : currentContent ? (
          <div className="prose prose-sm max-w-none text-[var(--fg)]/80
            prose-headings:text-[var(--fg)] prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1.5
            prose-h1:text-base prose-h2:text-sm prose-h3:text-xs
            prose-p:my-1 prose-p:leading-relaxed
            prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5
            prose-code:bg-[var(--surface-warm-hover)] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono prose-code:text-[var(--fg)]
            prose-pre:bg-[var(--surface-warm-hover)] prose-pre:text-[var(--fg)] prose-pre:rounded-lg prose-pre:p-3 prose-pre:my-2
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
            >{currentContent}</ReactMarkdown>
          </div>
        ) : activeTab.startsWith('action-') ? (
          <div className="flex flex-col items-center justify-center h-full text-xs text-[var(--muted)]/50 gap-2">
            <span>点击上方按钮执行 "{getCurrentActionInfo()?.label || '操作'}"</span>
            <span className="text-[var(--muted)]/30">结果将显示在此处</span>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-[var(--muted)]/50">
            {t('panel.codeWillAppear')}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useRef, useEffect, useCallback, useMemo, type KeyboardEvent, type MouseEvent } from 'react';
import {
  Send,
  Paperclip,
  Image,
  ChevronRight,
  ChevronDown,
  Sparkles,
  X,
} from 'lucide-react';
import ChartTypeSelect from '@/components/editor/ChartTypeSelect';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useDragAndDrop } from '@/hooks/useDragAndDrop';
import Notification from '@/components/ui/Notification';
import MessageBubble from './MessageBubble';
import { useLocale } from '@/lib/locales';
import FormatSelector from '@/components/editor/FormatSelector';
import Tooltip from '@/components/ui/Tooltip';
import type { SourceType, ConversationMessage } from '@/lib/types';
import type { DiagramFormat } from '@/lib/types/diagram-strategy';
import GenerationModeToggle, { type GenerationMode } from './GenerationModeToggle';

/** 从代码内容检测图表格式 */
function detectCodeFormat(code: string): DiagramFormat {
  const trimmed = code.trim();
  if (trimmed.startsWith('<')) return 'drawio';
  if (trimmed.startsWith('[')) return 'excalidraw';
  if (trimmed.startsWith('{') && trimmed.includes('"elements"')) return 'excalidraw';
  return 'mermaid';
}

/** 导出消息内容为文件 */
function exportMessage(content: string) {
  const format = detectCodeFormat(content);
  const ext = format === 'excalidraw' ? 'json' : format === 'mermaid' ? 'mmd' : 'drawio';
  const mime = format === 'excalidraw' ? 'application/json' : format === 'mermaid' ? 'text/plain' : 'application/xml';
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `diagram.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

interface AICopilotPanelProps {
  conversationId: string | null;
  messages: ConversationMessage[];
  isStreaming: boolean;
  onSendMessage: (message: string | { text: string; images: unknown[] }, chartType: string, source: SourceType) => void;
  onCancel: () => void;
  isGenerating: boolean;
  currentInput: string;
  currentChartType: string;
  currentFormat: DiagramFormat;
  onFormatChange: (format: DiagramFormat) => void;
  onExport: () => void;
  onRegenerate: () => void;
  onShowDiagram: (content: string) => void;
  apiError: string | null;
  onClearError: () => void;
  panelWidth?: number;
  onPanelWidthChange?: (width: number) => void;
  /** 从外部控制面板折叠状态 */
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /** 生成模式 */
  generationMode?: GenerationMode;
  onGenerationModeChange?: (mode: GenerationMode) => void;
}

export default function AICopilotPanel({
  conversationId,
  messages,
  isStreaming,
  onSendMessage,
  onCancel,
  isGenerating,
  currentInput,
  currentChartType,
  currentFormat,
  onFormatChange,
  onExport,
  onRegenerate,
  onShowDiagram,
  apiError,
  onClearError,
  panelWidth = 360,
  onPanelWidthChange,
  collapsed: collapsedProp,
  onCollapsedChange,
  generationMode = 'auto',
  onGenerationModeChange,
}: AICopilotPanelProps) {
  const { t } = useLocale();
  const [isCollapsedLocal, setIsCollapsedLocal] = useState(false);
  const isCollapsed = collapsedProp ?? isCollapsedLocal;
  const setIsCollapsed = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    setIsCollapsedLocal(prev => {
      const next = typeof value === 'function' ? value(prev) : value;
      onCollapsedChange?.(next);
      return next;
    });
  }, [onCollapsedChange]);
  const [prompt, setPrompt] = useState(currentInput || '');
  const [chartType, setChartType] = useState(currentChartType || 'auto');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevInputRef = useRef(currentInput);
  const prevChartTypeRef = useRef(currentChartType);

  const { attachments, payload, attachStatus, attachError, notification, closeNotification, handleFiles, clearAttachments, removeAttachment, canSend, getSourceType } = useFileUpload({ diagramFormat: currentFormat });

  const { isDragging, dragHandlers } = useDragAndDrop(handleFiles);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // 为图片附件创建 blob URL，并在 cleanup 中释放
  // NOTE: URL.createObjectURL 是副作用，理论上不应在 useMemo 中调用。
  // 但 useEffect + useState 会导致额外渲染周期，此处选择 useMemo 以保持同步初始化。
  // StrictMode 下可能创建重复 URL，但 cleanup 仍能正确释放；生产构建无此问题。
  const imageBlobUrls = useMemo(() => {
    const urls = new Map<File, string>();
    for (const file of attachments) {
      if (file.type.startsWith('image/')) {
        urls.set(file, URL.createObjectURL(file));
      }
    }
    return urls;
  }, [attachments]);

  useEffect(() => {
    return () => {
      imageBlobUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [imageBlobUrls]);

  // Auto-scroll to bottom when messages change
  const prevCountRef = useRef(0);
  const prevConvRef = useRef(conversationId);
  const prevCollapsedRef = useRef(isCollapsed);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  // 滑底判断辅助函数：是否在底部附近（阈值为容器高度的 20%）
  const isNearBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    const threshold = container.clientHeight * 0.2;
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  }, []);

  // 监听滚动事件，控制"回到底部"按钮显示
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
    setShowScrollToBottom(!atBottom && messages.length > 0);
  }, [messages.length]);

  // 执行滑底
  const scrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  }, []);

  // 消息变化 / 对话切换时的自动滑底
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const convChanged = conversationId !== prevConvRef.current;
    prevConvRef.current = conversationId;

    const isNewMessage = messages.length > prevCountRef.current;
    prevCountRef.current = messages.length;

    if (convChanged || isNewMessage) {
      // 对话切换或新消息：无条件滑底
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    } else {
      // 流式内容更新：仅在底部附近时滑底（阈值为容器高度的 20%）
      if (isNearBottom()) {
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
        });
      }
    }
  }, [messages, conversationId, isNearBottom]);

  // 折叠/展开时的滑底处理
  useEffect(() => {
    const wasCollapsed = prevCollapsedRef.current;
    prevCollapsedRef.current = isCollapsed;

    // 从折叠状态展开时，强制滑到底部
    if (wasCollapsed && !isCollapsed && messages.length > 0) {
      const container = messagesContainerRef.current;
      if (!container) return;

      // 使用双层 rAF 确保 DOM 布局稳定后再滑底
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
        });
      });
    }
  }, [isCollapsed, messages.length]);

  // 从 props 同步到 state（合理用例，避免级联渲染）
  useEffect(() => {
    if (currentInput !== undefined && currentInput !== prevInputRef.current) {
      prevInputRef.current = currentInput;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPrompt(currentInput);
    }
  }, [currentInput]);

  // 从 props 同步到 state（合理用例，避免级联渲染）
  useEffect(() => {
    const newChartType = currentChartType || 'auto';
    if (newChartType !== prevChartTypeRef.current) {
      prevChartTypeRef.current = newChartType;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChartType(newChartType);
    }
  }, [currentChartType, conversationId]);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 160) + 'px';
    }
  }, [prompt]);

  const canSendNow = (): boolean => {
    if (isGenerating) return false;
    return canSend(!!prompt.trim());
  };

  const handleSend = () => {
    if (!canSendNow()) return;

    if (payload) {
      if (payload.type === 'image') {
        // 图片 payload：将用户额外描述合并到 text 字段
        const imgContent = payload.content as { text: string; images: unknown[] };
        const mergedText = prompt.trim()
          ? `${prompt.trim()}\n\n${imgContent.text}`.trim()
          : imgContent.text;
        onSendMessage({ text: mergedText, images: imgContent.images }, chartType, 'image');
      } else {
        // 文件 payload：将用户额外描述合并到 content 前面
        const fileContent = payload.content as string;
        const merged = prompt.trim()
          ? `${prompt.trim()}\n\n${fileContent}`
          : fileContent;
        onSendMessage(merged, chartType, getSourceType());
      }
    } else if (prompt.trim()) {
      onSendMessage(prompt.trim(), chartType, 'text');
    }

    clearAttachments();
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
    setPrompt('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleResizeStart = useCallback((e: MouseEvent) => {
    if (!onPanelWidthChange) return;
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = panelWidth;

    const onMouseMove = (e: globalThis.MouseEvent) => {
      const delta = e.clientX - startX;
      onPanelWidthChange(startWidth + delta);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [panelWidth, onPanelWidthChange]);

  if (isCollapsed) {
    return (
      <div className="h-full bg-[var(--bg-glass)] backdrop-blur-2xl" style={{ width: 0, minWidth: 0 }} />
    );
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[var(--bg-glass)] backdrop-blur-2xl relative z-10" style={{ width: panelWidth, minWidth: panelWidth }}>
      {/* Resize Handle — 纯拖拽区域，不显示竖线（由分割线元素提供） */}
      {onPanelWidthChange && (
        <div
          onMouseDown={handleResizeStart}
          className="absolute top-0 right-0 w-2 h-full cursor-col-resize z-20"
        />
      )}

      {/* Error Banner */}
      {apiError && (
        <div className="mx-3 mt-3 px-3 py-2.5 rounded-xl bg-red-50/80 border border-red-200/50 flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-red-700 break-words">{apiError}</p>
          </div>
          <button onClick={onClearError} className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Message List or Empty State */}
      {hasMessages ? (
        <div ref={messagesContainerRef} onScroll={handleScroll} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4 scrollbar-subtle bg-[var(--surface-warm)]/30">
          {messages.map((msg, idx) => {
            const isLastAssistant = msg.role === 'assistant' && idx === messages.length - 1;
            const isAssistant = msg.role === 'assistant';
            const isMsgStreaming = isStreaming && msg.role === 'assistant' && msg.id === messages[messages.length - 1]?.id;
            return (
              <MessageBubble
                key={msg.id}
                message={msg}
                isStreaming={isMsgStreaming}
                onRegenerate={isLastAssistant && !isGenerating ? onRegenerate : undefined}
                onCopy={isAssistant && !isMsgStreaming ? () => navigator.clipboard.writeText(msg.content) : undefined}
                onExport={isAssistant && !isMsgStreaming ? () => exportMessage(msg.content) : undefined}
                onShowDiagram={isAssistant && !isMsgStreaming ? () => onShowDiagram(msg.content) : undefined}
              />
            );
          })}
          <div ref={messagesEndRef} />

          {/* 回到底部浮动按钮 */}
          {showScrollToBottom && (
            <button
              onClick={scrollToBottom}
              className="sticky bottom-3 left-1/2 -translate-x-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-[var(--surface-warm)] border border-[var(--border)] shadow-lg hover:bg-[var(--surface-warm-hover)] transition-all duration-200 z-10"
              title={t('copilot.scrollToBottom')}
            >
              <ChevronDown size={16} className="text-[var(--muted)]" />
            </button>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center px-6 overflow-auto">
          <div className="relative mb-5">
            <div className="absolute inset-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--accent-indigo)] to-[var(--accent-violet)] blur-xl opacity-30" />
            <div className="relative w-12 h-12 rounded-2xl bg-[var(--accent-indigo)]/10 flex items-center justify-center">
              <Sparkles size={20} className="text-[var(--accent-indigo)]" />
            </div>
          </div>
          <p className="text-sm font-semibold text-[var(--fg)] mb-1 tracking-tight">{t('copilot.aiChartAssistant')}</p>
          <p className="text-xs text-[var(--muted)] text-center mb-6 leading-relaxed">{t('copilot.describeChart')}</p>

          {/* Format Selector */}
          <div className="w-full mb-3">
            <FormatSelector value={currentFormat} onChange={onFormatChange} className="w-full" />
          </div>
          <div className="w-full mb-3">
            <GenerationModeToggle
              value={generationMode}
              onChange={(m) => onGenerationModeChange?.(m)}
              disabled={isGenerating}
            />
          </div>

          {/* Chart Type */}
          <div className="w-full">
            <ChartTypeSelect value={chartType} onChange={setChartType} format={currentFormat} />
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-black/[0.08] bg-black/[0.02] flex-shrink-0">
        {/* Format & Chart Type (when has messages) */}
        {hasMessages && (
          <div className="px-4 pt-3 pb-1 space-y-2">
            <FormatSelector value={currentFormat} onChange={onFormatChange} className="w-full" />
            <GenerationModeToggle
              value={generationMode}
              onChange={(m) => onGenerationModeChange?.(m)}
              disabled={isGenerating}
            />
            <ChartTypeSelect value={chartType} onChange={setChartType} format={currentFormat} />
          </div>
        )}

        {/* Text Input */}
        <div className="px-4 pt-2">
          <div
            className="relative"
            {...dragHandlers}
          >
            {isDragging && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--accent-indigo)]/5 border-2 border-dashed border-[var(--accent-indigo)]/30 rounded-xl pointer-events-none">
                <span className="text-sm font-medium text-[var(--accent-indigo)]">{t('copilot.dropFiles')}</span>
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={hasMessages ? t('copilot.continueDescribe') : t('copilot.describeChart') + '...'}
              className="w-full resize-none bg-[var(--surface-warm)] text-sm leading-relaxed text-[var(--fg)] placeholder:text-[var(--muted)]/60 focus:outline-none focus:ring-1 focus:ring-[var(--accent-indigo)]/20 hover:border-[var(--accent-indigo)]/20 min-h-[60px] max-h-[160px] rounded-xl px-3 py-2.5 border border-[var(--border)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200"
            />
          </div>

          {/* Attachment Cards */}
          {attachments.length > 0 && (
            <div className={`mt-2 grid gap-2 ${attachments.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {attachments.map((file, i) => {
                const isImage = file.type.startsWith('image/');
                return (
                  <div key={`${file.name}-${i}`} className="relative flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[var(--surface-warm-hover)] border border-[var(--surface-warm-hover)] group">
                    {isImage ? (
                      // eslint-disable-next-line @next/next/no-img-element -- blob URL 不支持 next/image
                      <img src={imageBlobUrls.get(file)} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-[var(--surface-warm)] flex items-center justify-center flex-shrink-0">
                        <Paperclip size={13} className="text-[var(--muted)]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-[var(--fg)] truncate">{file.name}</p>
                      {attachStatus === 'processing' && <p className="text-[10px] text-[var(--muted)]">{t('upload.processing')}</p>}
                      {attachStatus === 'success' && <p className="text-[10px] text-[var(--accent-indigo)]">{t('upload.ready')}</p>}
                      {attachStatus === 'error' && <p className="text-[10px] text-red-500">{attachError}</p>}
                    </div>
                    <button onClick={() => removeAttachment(i)} className="opacity-0 group-hover:opacity-100 text-[var(--muted)] hover:text-[var(--fg)] transition-all flex-shrink-0">
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* Action Buttons */}
        <div className="px-4 py-3 flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.txt"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(Array.from(e.target.files || []))}
          />
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(Array.from(e.target.files || []))}
          />
          <Tooltip content={t('copilot.uploadFile')} side="top">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isGenerating}
              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 disabled:opacity-40 ${
                attachments.length > 0 && getSourceType() === 'file' ? 'bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)]' : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)]'
              }`}
            >
              <Paperclip size={15} />
            </button>
          </Tooltip>
          <Tooltip content={t('copilot.uploadImage')} side="top">
            <button
              onClick={() => imageInputRef.current?.click()}
              disabled={isGenerating}
              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 disabled:opacity-40 ${
                attachments.length > 0 && getSourceType() === 'image' ? 'bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)]' : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)]'
              }`}
            >
              {/* eslint-disable-next-line jsx-a11y/alt-text -- lucide Image 是 SVG 图标，不是 <img> */}
              <Image size={15} />
            </button>
          </Tooltip>
          <div className="flex-1" />
          {isGenerating ? (
            <button
              onClick={onCancel}
              className="h-8 px-4 flex items-center gap-1.5 bg-red-500 text-white text-xs font-medium rounded-xl hover:bg-red-600 active:scale-[0.98] transition-all duration-200 shadow-[0_2px_10px_rgba(220,38,38,0.15)]"
            >
              <X size={13} /><span>{t('copilot.stop')}</span>
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!canSendNow()}
              className="h-8 px-4 flex items-center gap-1.5 bg-[var(--btn-primary)] text-[var(--btn-primary-text)] text-xs font-medium rounded-xl hover:bg-[var(--btn-primary-hover)] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-[0_2px_10px_rgba(28,25,23,0.08)]"
            >
              <><Send size={13} /><span>{hasMessages ? t('copilot.send') : t('copilot.generate')}</span></>
            </button>
          )}
        </div>

      </div>

      <Notification
        isOpen={notification.isOpen}
        onClose={closeNotification}
        title={notification.title}
        message={notification.message}
        type={notification.type}
      />

    </div>
  );
}

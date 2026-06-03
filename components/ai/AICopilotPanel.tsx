'use client';

import { useState, useRef, useEffect, useCallback, type KeyboardEvent, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Send,
  Paperclip,
  Image,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Wand2,
  Loader2,
  X,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { AppIcon } from '../layout/TopBar';
import ChartTypeSelect from '@/components/editor/ChartTypeSelect';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useDragAndDrop } from '@/hooks/useDragAndDrop';
import Notification from '@/components/ui/Notification';
import MessageBubble from './MessageBubble';
import ConversationList from './ConversationList';
import { useLocale } from '@/lib/locales';
import FormatSelector from '@/components/editor/FormatSelector';
import Tooltip from '@/components/ui/Tooltip';
import type { SourceType, ConversationMessage } from '@/lib/types';
import type { DiagramFormat } from '@/lib/types/diagram-strategy';

/** 导出消息内容为文件 */
function exportMessage(content: string, format: DiagramFormat) {
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
  onLoadConversation: (id: string) => void;
  onNewConversation: () => void;
  onSendMessage: (message: string | { text: string; images: unknown[] }, chartType: string, source: SourceType) => void;
  onCancel: () => void;
  isGenerating: boolean;
  currentInput: string;
  currentChartType: string;
  currentFormat: DiagramFormat;
  onFormatChange: (format: DiagramFormat) => void;
  onOpenConfig: () => void;
  onExport: () => void;
  onRegenerate: () => void;
  onShowDiagram: (content: string) => void;
  apiError: string | null;
  onClearError: () => void;
  panelWidth?: number;
  onPanelWidthChange?: (width: number) => void;
  /** 右侧额外内容（如窗口控制按钮），渲染在头部按钮组之后 */
  headerExtra?: React.ReactNode;
}

export default function AICopilotPanel({
  conversationId,
  messages,
  isStreaming,
  onLoadConversation,
  onNewConversation,
  onSendMessage,
  onCancel,
  isGenerating,
  currentInput,
  currentChartType,
  currentFormat,
  onFormatChange,
  onOpenConfig,
  onExport,
  onRegenerate,
  onShowDiagram,
  apiError,
  onClearError,
  panelWidth = 360,
  onPanelWidthChange,
  headerExtra,
}: AICopilotPanelProps) {
  const router = useRouter();
  const { t } = useLocale();
  const [isCollapsed, setIsCollapsed] = useState(false);
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

  // Auto-scroll to bottom when messages change
  const prevCountRef = useRef(0);
  const prevConvRef = useRef(conversationId);
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const convChanged = conversationId !== prevConvRef.current;
    prevConvRef.current = conversationId;

    const isNewMessage = messages.length > prevCountRef.current;
    prevCountRef.current = messages.length;

    if (convChanged || isNewMessage) {
      // Conversation switch or new message: always scroll to bottom
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    } else {
      // Streaming content update: only scroll if near bottom
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
      if (isNearBottom) {
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
        });
      }
    }
  }, [messages, conversationId]);

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
      <div className="h-full flex flex-col items-center py-4 bg-[var(--bg-glass)] backdrop-blur-2xl border-r border-[var(--accent-violet)]/20">
        <Tooltip content={t('copilot.expandPanel')} side="right">
          <button
            onClick={() => setIsCollapsed(false)}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200"
          >
            <ChevronRight size={18} />
          </button>
        </Tooltip>
      </div>
    );
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[var(--bg-glass)] backdrop-blur-2xl relative z-10" style={{ width: panelWidth, minWidth: panelWidth }}>
      {/* Resize Handle */}
      {onPanelWidthChange && (
        <div
          onMouseDown={handleResizeStart}
          className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize z-20 group"
        >
          <div className="w-0.5 h-full mx-auto bg-[var(--accent-violet)]/10 group-hover:bg-[var(--accent-violet)]/40 transition-colors duration-200" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-6 h-14 border-b border-[var(--border)] flex-shrink-0" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <div className="flex items-center gap-2.5 min-w-0" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <Tooltip content={t('copilot.backHome')} side="bottom">
            <button
              onClick={() => router.push('/')}
              className="hover:opacity-80 transition-opacity duration-200 relative"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-indigo)] to-[var(--accent-violet)] rounded-lg blur-md opacity-20" />
              <div className="relative"><AppIcon size={22} /></div>
            </button>
          </Tooltip>
          <ConversationList
            currentId={conversationId}
            onSelect={onLoadConversation}
            onNew={onNewConversation}
          />
        </div>
        <div className="flex items-center gap-1 flex-shrink-0" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <Tooltip content={t('copilot.config')} side="bottom">
            <button
              onClick={onOpenConfig}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200"
            >
              <Wand2 size={15} />
            </button>
          </Tooltip>
          <button
            onClick={() => setIsCollapsed(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200"
          >
            <ChevronLeft size={16} />
          </button>
          {headerExtra}
        </div>
      </div>

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
        <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4 scrollbar-subtle bg-[var(--surface-warm)]/30">
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
                onExport={isAssistant && !isMsgStreaming ? () => exportMessage(msg.content, currentFormat) : undefined}
                onShowDiagram={isAssistant && !isMsgStreaming ? () => onShowDiagram(msg.content) : undefined}
              />
            );
          })}
          <div ref={messagesEndRef} />
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

          {/* Chart Type */}
          <div className="w-full">
            <ChartTypeSelect value={chartType} onChange={setChartType} />
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-black/[0.08] bg-black/[0.02] flex-shrink-0">
        {/* Format & Chart Type (when has messages) */}
        {hasMessages && (
          <div className="px-4 pt-3 pb-1 space-y-2">
            <FormatSelector value={currentFormat} onChange={onFormatChange} className="w-full" />
            <ChartTypeSelect value={chartType} onChange={setChartType} />
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
              className="w-full resize-none bg-[var(--surface-warm)] text-sm leading-relaxed text-[var(--fg)] placeholder:text-[var(--muted)]/60 focus:outline-none focus:ring-1 focus:ring-[var(--accent-indigo)]/20 min-h-[60px] max-h-[160px] rounded-xl px-3 py-2.5 border border-[var(--border)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]"
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
                      <img src={URL.createObjectURL(file)} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-[var(--surface-warm)] flex items-center justify-center flex-shrink-0">
                        <Paperclip size={13} className="text-[var(--muted)]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-[var(--fg)] truncate">{file.name}</p>
                      {attachStatus === 'processing' && <p className="text-[10px] text-[var(--muted)]">处理中...</p>}
                      {attachStatus === 'success' && <p className="text-[10px] text-[var(--accent-indigo)]">就绪</p>}
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

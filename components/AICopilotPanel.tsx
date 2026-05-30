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
  Download,
  Wand2,
  Loader2,
  X,
  CheckCircle,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { AppIcon } from './TopBar';
import ChartTypeSelect from './ChartTypeSelect';
import { useFileUpload } from '@/composables/useFileUpload';
import Notification from './Notification';
import MessageBubble from './MessageBubble';
import ConversationList from './ConversationList';
import { useLocale } from '@/locales';
import type { SourceType, ConversationMessage } from '@/types';
import type { DiagramFormat } from '@/types/diagram-strategy';

const FORMATS = [
  { key: 'excalidraw' as DiagramFormat, label: 'Excalidraw' },
  { key: 'mermaid' as DiagramFormat, label: 'Mermaid' },
  { key: 'drawio' as DiagramFormat, label: 'Draw.io' },
];

interface AICopilotPanelProps {
  conversationId: string | null;
  messages: ConversationMessage[];
  isStreaming: boolean;
  onLoadConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onSendMessage: (message: string | { text: string; images: unknown[] }, chartType: string, source: SourceType) => void;
  onCancel: () => void;
  isGenerating: boolean;
  currentInput: string;
  currentChartType: string;
  currentFormat: DiagramFormat;
  onFormatChange: (format: DiagramFormat) => void;
  onOpenConfig: () => void;
  onExport: () => void;
  apiError: string | null;
  onClearError: () => void;
  panelWidth?: number;
  onPanelWidthChange?: (width: number) => void;
}

export default function AICopilotPanel({
  conversationId,
  messages,
  isStreaming,
  onLoadConversation,
  onNewConversation,
  onDeleteConversation,
  onSendMessage,
  onCancel,
  isGenerating,
  currentInput,
  currentChartType,
  currentFormat,
  onFormatChange,
  onOpenConfig,
  onExport,
  apiError,
  onClearError,
  panelWidth = 360,
  onPanelWidthChange,
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

  const { attachments, payload, attachStatus, attachError, notification, closeNotification, handleFiles, clearAttachments, removeAttachment, canSend, getSourceType } = useFileUpload({ diagramFormat: currentFormat });

  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when messages change
  const prevCountRef = useRef(0);
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const isNewMessage = messages.length > prevCountRef.current;
    prevCountRef.current = messages.length;

    if (isNewMessage) {
      // New message: always scroll to bottom
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
  }, [messages]);

  useEffect(() => {
    if (currentInput !== undefined) setPrompt(currentInput);
  }, [currentInput]);

  useEffect(() => {
    if (currentChartType !== undefined) setChartType(currentChartType);
  }, [currentChartType]);

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

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;
    handleFiles(Array.from(e.dataTransfer.files));
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
      <div className="h-full flex flex-col items-center py-4 bg-[var(--bg-glass)] backdrop-blur-2xl border-r border-[var(--accent-violet)]/20 animate-fade-in">
        <button
          onClick={() => setIsCollapsed(false)}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200"
          title={t('copilot.expandPanel')}
        >
          <ChevronRight size={18} />
        </button>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 mt-8">
          <button className="w-9 h-9 flex items-center justify-center rounded-xl text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200" title={t('copilot.aiChat')}>
            <Sparkles size={18} />
          </button>
          <button onClick={onExport} className="w-9 h-9 flex items-center justify-center rounded-xl text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200" title={t('copilot.export')}>
            <Download size={18} />
          </button>
        </div>
      </div>
    );
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[var(--bg-glass)] backdrop-blur-2xl relative z-10 animate-fade-in" style={{ width: panelWidth, minWidth: panelWidth }}>
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
      <div className="flex items-center justify-between px-4 h-14 border-b border-[var(--surface-warm-hover)] flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={() => router.push('/')}
            className="hover:opacity-80 transition-opacity duration-200 relative"
            title={t('copilot.backHome')}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-indigo)] to-[var(--accent-violet)] rounded-lg blur-md opacity-20" />
            <div className="relative"><AppIcon size={22} /></div>
          </button>
          <ConversationList
            currentId={conversationId}
            onSelect={onLoadConversation}
            onDelete={onDeleteConversation}
            onNew={onNewConversation}
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onNewConversation}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200"
            title={t('copilot.newConversation')}
          >
            <Plus size={16} />
          </button>
          <button
            onClick={() => setIsCollapsed(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200"
          >
            <ChevronLeft size={16} />
          </button>
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
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isStreaming={isStreaming && msg.role === 'assistant' && msg.id === messages[messages.length - 1]?.id}
            />
          ))}
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
            <div className="segmented-control w-full">
              {FORMATS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => onFormatChange(f.key)}
                  className={`segmented-control-item ${currentFormat === f.key ? 'active' : ''}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
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
            <div className="segmented-control w-full">
              {FORMATS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => onFormatChange(f.key)}
                  className={`segmented-control-item ${currentFormat === f.key ? 'active' : ''}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <ChartTypeSelect value={chartType} onChange={setChartType} />
          </div>
        )}

        {/* Text Input */}
        <div className="px-4 pt-2">
          <div
            className="relative"
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
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
              className="w-full resize-none bg-white/60 text-sm leading-relaxed text-[var(--fg)] placeholder:text-[var(--muted)]/60 focus:outline-none focus:ring-1 focus:ring-[var(--accent-indigo)]/20 min-h-[60px] max-h-[160px] rounded-xl px-3 py-2.5 border border-black/[0.1] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]"
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
                      <img src={URL.createObjectURL(file)} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-[var(--surface-warm)] flex items-center justify-center flex-shrink-0">
                        <Paperclip size={13} className="text-[var(--muted)]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-[var(--fg)] truncate">{file.name}</p>
                      {attachStatus === 'processing' && <p className="text-[10px] text-[var(--muted)]">处理中...</p>}
                      {attachStatus === 'success' && <p className="text-[10px] text-emerald-500">就绪</p>}
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
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isGenerating}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 disabled:opacity-40 ${
              attachments.length > 0 && getSourceType() === 'file' ? 'bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)]' : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)]'
            }`}
            title={t('copilot.uploadFile')}
          >
            <Paperclip size={15} />
          </button>
          <button
            onClick={() => imageInputRef.current?.click()}
            disabled={isGenerating}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 disabled:opacity-40 ${
              attachments.length > 0 && getSourceType() === 'image' ? 'bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)]' : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)]'
            }`}
            title={t('copilot.uploadImage')}
          >
            <Image size={15} />
          </button>
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
              className="h-8 px-4 flex items-center gap-1.5 bg-[var(--primary)] text-white text-xs font-medium rounded-xl hover:bg-[var(--primary)]/90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-[0_2px_10px_rgba(28,25,23,0.08)]"
            >
              <><Send size={13} /><span>{hasMessages ? t('copilot.send') : t('copilot.generate')}</span></>
            </button>
          )}
        </div>

      </div>

      {/* Bottom Actions */}
      <div className="border-t border-[var(--surface-warm-hover)] px-4 py-3 flex items-center gap-1 flex-shrink-0">
        <button onClick={onOpenConfig} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] rounded-lg transition-all duration-200">
          <Wand2 size={13} /><span>{t('copilot.config')}</span>
        </button>
        <div className="flex-1" />
        <button onClick={onExport} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] rounded-lg transition-all duration-200">
          <Download size={13} /><span>{t('copilot.export')}</span>
        </button>
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

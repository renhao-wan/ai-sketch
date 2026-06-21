'use client';

import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import {
  Send,
  Paperclip,
  Image,
  X,
  MessageSquare,
  MessagesSquare,
} from 'lucide-react';
import ChartTypeSelect from '@/components/editor/ChartTypeSelect';
import FormatSelector from '@/components/editor/FormatSelector';
import Tooltip from '@/components/ui/Tooltip';
import Notification from '@/components/ui/Notification';
import AttachmentCards from './AttachmentCards';
import GenerationModeToggle from './GenerationModeToggle';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useDragAndDrop } from '@/hooks/useDragAndDrop';
import { useLocale } from '@/lib/locales';
import type { SourceType } from '@/lib/types';
import type { DiagramFormat } from '@/lib/types/diagram-strategy';
import type { GenerationMode } from '@/lib/generation/types';

interface ChatInputProps {
  hasMessages: boolean;
  isGenerating: boolean;
  /** 外部输入同步（如从首页预填充、恢复历史） */
  currentInput?: string;
  currentFormat: DiagramFormat;
  currentChartType: string;
  /** 用于切换对话时重新同步 chartType */
  conversationId?: string | null;
  onFormatChange: (format: DiagramFormat) => void;
  onSendMessage: (message: string | { text: string; images: unknown[] }, chartType: string, source: SourceType) => void;
  onCancel: () => void;
  /** 生成模式 */
  generationMode?: GenerationMode;
  onGenerationModeChange?: (mode: GenerationMode) => void;
  /** 上下文开关 */
  contextEnabled?: boolean;
  onContextEnabledChange?: (enabled: boolean) => void;
}

export default function ChatInput({
  hasMessages,
  isGenerating,
  currentInput,
  currentFormat,
  currentChartType,
  conversationId,
  onFormatChange,
  onSendMessage,
  onCancel,
  generationMode = 'auto',
  onGenerationModeChange,
  contextEnabled = true,
  onContextEnabledChange,
}: ChatInputProps) {
  const { t } = useLocale();
  const [prompt, setPrompt] = useState(currentInput || '');
  const [chartType, setChartType] = useState(currentChartType || 'auto');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const prevInputRef = useRef(currentInput);
  const prevChartTypeRef = useRef(currentChartType);

  const { attachments, payload, attachStatus, attachError, notification, closeNotification, handleFiles, clearAttachments, removeAttachment, canSend, getSourceType } = useFileUpload({ diagramFormat: currentFormat });
  const { isDragging, dragHandlers } = useDragAndDrop(handleFiles);

  // 为图片附件创建 blob URL
  const [imageBlobUrls, setImageBlobUrls] = useState<Map<File, string>>(new Map());

  useEffect(() => {
    const urls = new Map<File, string>();
    for (const file of attachments) {
      if (file.type.startsWith('image/')) {
        urls.set(file, URL.createObjectURL(file));
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 需要同步创建 URL 供渲染使用，cleanup 中释放
    setImageBlobUrls(urls);
    return () => {
      urls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [attachments]);

  // 从 props 同步 currentInput 到 prompt（带防抖 guard）
  useEffect(() => {
    if (currentInput !== undefined && currentInput !== prevInputRef.current) {
      prevInputRef.current = currentInput;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPrompt(currentInput);
    }
  }, [currentInput]);

  // 同步外部 chartType 变化（含 conversationId 依赖，切换对话时重新同步）
  useEffect(() => {
    const newChartType = currentChartType || 'auto';
    if (newChartType !== prevChartTypeRef.current) {
      prevChartTypeRef.current = newChartType;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChartType(newChartType);
    }
  }, [currentChartType, conversationId]);

  // 自动调整 textarea 高度
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
        const imgContent = payload.content as { text: string; images: unknown[] };
        const mergedText = prompt.trim()
          ? `${prompt.trim()}\n\n${imgContent.text}`.trim()
          : imgContent.text;
        onSendMessage({ text: mergedText, images: imgContent.images }, chartType, 'image');
      } else {
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

  return (
    <div className="border-t border-black/[0.08] bg-black/[0.02] flex-shrink-0">
      {/* Format & Chart Type */}
      <div className="px-4 pt-3 pb-1 space-y-2">
        <div id="onboarding-format-selector">
          <FormatSelector value={currentFormat} onChange={onFormatChange} className="w-full" />
        </div>
        <div id="onboarding-chart-type">
          <ChartTypeSelect value={chartType} onChange={setChartType} format={currentFormat} />
        </div>
      </div>

      {/* Text Input */}
      <div className="px-4 pt-2">
        <div className="relative" {...dragHandlers}>
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

        <AttachmentCards
          attachments={attachments}
          imageBlobUrls={imageBlobUrls}
          attachStatus={attachStatus}
          attachError={attachError}
          onRemove={removeAttachment}
        />
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
        <div id="onboarding-context-toggle">
        <Tooltip content={contextEnabled ? t('copilot.contextOn') : t('copilot.contextOff')} side="top">
          <button
            onClick={() => onContextEnabledChange?.(!contextEnabled)}
            disabled={isGenerating}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 disabled:opacity-40 ${
              contextEnabled
                ? 'text-[var(--accent-indigo)] bg-[var(--accent-indigo)]/10'
                : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)]'
            }`}
          >
            {contextEnabled ? <MessagesSquare size={15} /> : <MessageSquare size={15} />}
          </button>
        </Tooltip>
        </div>
        <div id="onboarding-generation-mode">
        <GenerationModeToggle
          value={generationMode}
          onChange={(m) => onGenerationModeChange?.(m)}
          disabled={isGenerating}
        />
        </div>
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

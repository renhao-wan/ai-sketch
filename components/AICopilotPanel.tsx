'use client';

import { useState, useRef, useEffect, useCallback, type ChangeEvent, type KeyboardEvent, type MouseEvent } from 'react';
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
import { imageStrategy, fileStrategy } from '@/lib/input-strategies/registry';
import ImageUpload from './ImageUpload';
import MessageBubble from './MessageBubble';
import ConversationList from './ConversationList';
import { useLocale } from '@/locales';
import type { SourceType, ImageObject, ConversationMessage } from '@/types';
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
  const [showImageUpload, setShowImageUpload] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [fileStatus, setFileStatus] = useState<'' | 'parsing' | 'success' | 'error'>('');
  const [fileError, setFileError] = useState('');

  const [selectedImage, setSelectedImage] = useState<(ImageObject & { previewUrl: string; file: File }) | null>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  const canSend = (): boolean => {
    if (isGenerating) return false;
    return !!(prompt.trim() || (fileStatus === 'success' && fileContent) || (showImageUpload && selectedImage));
  };

  const handleSend = () => {
    if (!canSend()) return;

    if (showImageUpload && selectedImage) {
      const msg = imageStrategy.buildMessage({ imageObject: selectedImage, previewUrl: '' }, prompt, chartType);
      if (msg.type === 'image') {
        onSendMessage(msg.content, chartType, 'image');
      }
    } else if (fileStatus === 'success' && fileContent) {
      const msg = fileStrategy.buildMessage(fileContent, prompt, chartType);
      if (msg.type === 'text') {
        onSendMessage(msg.content, chartType, 'file');
      }
    } else if (prompt.trim()) {
      onSendMessage(prompt.trim(), chartType, 'text');
    }

    // Clear input after send
    setPrompt('');
    handleClearFile();
    setShowImageUpload(false);
    setSelectedImage(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = fileStrategy.validate(file);
    if (!validation.valid) {
      setFileError(validation.error);
      setFileStatus('error');
      return;
    }

    setShowImageUpload(false);
    setSelectedFile(file);
    setFileStatus('parsing');
    setFileError('');

    try {
      const content = await fileStrategy.process(file);
      setFileContent(content as string);
      setFileStatus('success');
    } catch (err) {
      setFileError((err as Error).message);
      setFileStatus('error');
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setFileContent('');
    setFileStatus('');
    setFileError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImageSubmit = () => {
    if (!selectedImage || isGenerating) return;
    const msg = imageStrategy.buildMessage({ imageObject: selectedImage, previewUrl: '' }, '', chartType);
    if (msg.type === 'image') {
      onSendMessage(msg.content, chartType, 'image');
    }
  };

  const handleToggleImage = () => {
    if (showImageUpload) {
      setShowImageUpload(false);
      setSelectedImage(null);
    } else {
      setShowImageUpload(true);
      handleClearFile();
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
    <div className="h-full flex flex-col bg-[var(--bg-glass)] backdrop-blur-2xl relative z-10 animate-fade-in" style={{ width: panelWidth, minWidth: panelWidth }}>
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
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin">
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
            <div className="segmented-control">
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
      <div className="border-t border-[var(--surface-warm-hover)] flex-shrink-0">
        {/* Format & Chart Type (when has messages) */}
        {hasMessages && !showImageUpload && (
          <div className="px-4 pt-3 pb-1 space-y-2">
            <div className="segmented-control">
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

        {/* Text Input or Image Upload */}
        <div className="px-4 pt-2">
          {showImageUpload ? (
            <div className="min-h-[120px] flex flex-col">
              <ImageUpload
                onImageSelect={setSelectedImage}
                isGenerating={isGenerating}
                chartType={chartType}
                onChartTypeChange={setChartType}
                onImageGenerate={handleImageSubmit}
              />
            </div>
          ) : (
            <>
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={hasMessages ? t('copilot.continueDescribe') : t('copilot.describeChart') + '...'}
                className="w-full resize-none bg-transparent text-sm leading-relaxed text-[var(--fg)] placeholder:text-[var(--muted)]/50 focus:outline-none min-h-[60px] max-h-[160px]"
              />

              {/* File Status */}
              {selectedFile && (
                <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--surface-warm-hover)] border border-[var(--surface-warm-hover)]">
                  {fileStatus === 'parsing' && <Loader2 size={13} className="animate-spin text-[var(--muted)] flex-shrink-0" />}
                  {fileStatus === 'success' && <CheckCircle size={13} className="text-emerald-500 flex-shrink-0" />}
                  {fileStatus === 'error' && <AlertCircle size={13} className="text-red-500 flex-shrink-0" />}
                  <span className="text-xs text-[var(--fg)] truncate flex-1">{selectedFile.name}</span>
                  {fileStatus === 'success' && <span className="text-[10px] text-[var(--muted)]/60 flex-shrink-0">{fileContent.length} {t('copilot.characters')}</span>}
                  {fileStatus === 'error' && <span className="text-[10px] text-red-500 flex-shrink-0">{fileError}</span>}
                  <button onClick={handleClearFile} className="text-[var(--muted)] hover:text-[var(--fg)] transition-colors flex-shrink-0 ml-1">
                    <X size={13} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="px-4 py-3 flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.txt"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isGenerating}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200 disabled:opacity-40"
            title={t('copilot.uploadFile')}
          >
            <Paperclip size={15} />
          </button>
          <button
            onClick={handleToggleImage}
            disabled={isGenerating}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 disabled:opacity-40 ${
              showImageUpload ? 'bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)]' : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)]'
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
              disabled={!canSend()}
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
    </div>
  );
}

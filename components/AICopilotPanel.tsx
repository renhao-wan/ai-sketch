'use client';

import { useState, useRef, useEffect, type ChangeEvent, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Send,
  Paperclip,
  Image,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  History,
  Download,
  Wand2,
  LayoutGrid,
  FileText,
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
import type { SourceType, ImageObject, ConversationMessage } from '@/types';

interface AICopilotPanelProps {
  conversationId: string | null;
  messages: ConversationMessage[];
  isStreaming: boolean;
  onLoadConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onSendMessage: (message: string | { text: string; images: unknown[] }, chartType: string, source: SourceType) => void;
  isGenerating: boolean;
  currentInput: string;
  currentChartType: string;
  onOpenHistory: () => void;
  onOpenConfig: () => void;
  onExport: () => void;
  apiError: string | null;
  onClearError: () => void;
}

const SUGGESTION_CHIPS = [
  { icon: FileText, label: '生成架构图' },
  { icon: LayoutGrid, label: '转换为时序图' },
  { icon: Wand2, label: '优化布局' },
  { icon: Sparkles, label: '添加图例' },
];

export default function AICopilotPanel({
  conversationId,
  messages,
  isStreaming,
  onLoadConversation,
  onNewConversation,
  onDeleteConversation,
  onSendMessage,
  isGenerating,
  currentInput,
  currentChartType,
  onOpenHistory,
  onOpenConfig,
  onExport,
  apiError,
  onClearError,
}: AICopilotPanelProps) {
  const router = useRouter();
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

  const handleChipClick = (label: string) => {
    setShowImageUpload(false);
    handleClearFile();
    onSendMessage(label, chartType, 'text');
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

  if (isCollapsed) {
    return (
      <div className="h-full flex flex-col items-center py-4 bg-white/65 backdrop-blur-2xl border-r border-white/10">
        <button
          onClick={() => setIsCollapsed(false)}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5 transition-all duration-200"
          title="展开面板"
        >
          <ChevronRight size={18} />
        </button>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 mt-8">
          <button className="w-9 h-9 flex items-center justify-center rounded-xl text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5 transition-all duration-200" title="AI 对话">
            <Sparkles size={18} />
          </button>
          <button onClick={onOpenHistory} className="w-9 h-9 flex items-center justify-center rounded-xl text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5 transition-all duration-200" title="历史记录">
            <History size={18} />
          </button>
          <button onClick={onExport} className="w-9 h-9 flex items-center justify-center rounded-xl text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5 transition-all duration-200" title="导出">
            <Download size={18} />
          </button>
        </div>
      </div>
    );
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="h-full flex flex-col bg-white/65 backdrop-blur-2xl border-r border-white/10 w-[360px] min-w-[360px] relative z-10">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-black/5 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => router.push('/')}
            className="hover:opacity-80 transition-opacity duration-200"
            title="返回首页"
          >
            <AppIcon size={22} />
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
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5 transition-all duration-200"
            title="New Conversation"
          >
            <Plus size={16} />
          </button>
          <button
            onClick={() => setIsCollapsed(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5 transition-all duration-200"
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
          <div className="w-12 h-12 rounded-2xl bg-[var(--accent-indigo)]/10 flex items-center justify-center mb-4">
            <Sparkles size={20} className="text-[var(--accent-indigo)]" />
          </div>
          <p className="text-sm font-medium text-[var(--fg)] mb-1">AI Diagram Assistant</p>
          <p className="text-xs text-[var(--muted)] text-center mb-6">Describe the diagram you want to create</p>

          {/* Chart Type */}
          <div className="w-full mb-4">
            <ChartTypeSelect value={chartType} onChange={setChartType} />
          </div>

          {/* Suggestion Chips */}
          <div className="flex flex-wrap gap-1.5 justify-center">
            {SUGGESTION_CHIPS.map((chip) => (
              <button
                key={chip.label}
                onClick={() => handleChipClick(chip.label)}
                disabled={isGenerating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--muted)] bg-black/4 hover:bg-black/8 rounded-full transition-all duration-200 disabled:opacity-50"
              >
                <chip.icon size={12} />
                <span>{chip.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-black/5 flex-shrink-0">
        {/* Chart Type (when has messages) */}
        {hasMessages && !showImageUpload && (
          <div className="px-4 pt-3 pb-1">
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
                placeholder={hasMessages ? 'Follow up on the diagram...' : 'Describe the diagram you want to create...'}
                className="w-full resize-none bg-transparent text-sm leading-relaxed text-[var(--fg)] placeholder:text-[var(--muted)]/50 focus:outline-none min-h-[60px] max-h-[160px]"
              />

              {/* File Status */}
              {selectedFile && (
                <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-black/[0.03] border border-black/[0.06]">
                  {fileStatus === 'parsing' && <Loader2 size={13} className="animate-spin text-[var(--muted)] flex-shrink-0" />}
                  {fileStatus === 'success' && <CheckCircle size={13} className="text-emerald-500 flex-shrink-0" />}
                  {fileStatus === 'error' && <AlertCircle size={13} className="text-red-500 flex-shrink-0" />}
                  <span className="text-xs text-[var(--fg)] truncate flex-1">{selectedFile.name}</span>
                  {fileStatus === 'success' && <span className="text-[10px] text-[var(--muted)]/60 flex-shrink-0">{fileContent.length} 字符</span>}
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
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5 transition-all duration-200 disabled:opacity-40"
            title="上传文件"
          >
            <Paperclip size={15} />
          </button>
          <button
            onClick={handleToggleImage}
            disabled={isGenerating}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 disabled:opacity-40 ${
              showImageUpload ? 'bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)]' : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5'
            }`}
            title="上传图片"
          >
            <Image size={15} />
          </button>
          <div className="flex-1" />
          <button
            onClick={handleSend}
            disabled={!canSend()}
            className="h-8 px-4 flex items-center gap-1.5 bg-[var(--primary)] text-white text-xs font-medium rounded-lg hover:bg-[var(--primary)]/90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
          >
            {isGenerating ? (
              <><Loader2 size={13} className="animate-spin" /><span>生成中</span></>
            ) : (
              <><Send size={13} /><span>{hasMessages ? '发送' : '生成'}</span></>
            )}
          </button>
        </div>

        {/* Suggestion Chips (only when no messages) */}
        {!hasMessages && (
          <div className="px-4 pb-4">
            <p className="text-[11px] text-[var(--muted)] mb-2">快捷操作</p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTION_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => handleChipClick(chip.label)}
                  disabled={isGenerating}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--muted)] bg-black/4 hover:bg-black/8 rounded-full transition-all duration-200 disabled:opacity-50"
                >
                  <chip.icon size={12} />
                  <span>{chip.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="border-t border-black/5 px-4 py-3 flex items-center gap-1 flex-shrink-0">
        <button onClick={onOpenHistory} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5 rounded-lg transition-all duration-200">
          <History size={13} /><span>历史记录</span>
        </button>
        <button onClick={onOpenConfig} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5 rounded-lg transition-all duration-200">
          <Wand2 size={13} /><span>配置</span>
        </button>
        <div className="flex-1" />
        <button onClick={onExport} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5 rounded-lg transition-all duration-200">
          <Download size={13} /><span>导出</span>
        </button>
      </div>
    </div>
  );
}

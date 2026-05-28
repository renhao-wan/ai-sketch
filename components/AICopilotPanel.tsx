'use client';

import { useState, useRef, useEffect, type ChangeEvent, type KeyboardEvent } from 'react';
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
import { CHART_TYPES } from '@/lib/constants';
import { generateImagePrompt } from '@/lib/image-utils';
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
  onSendMessage: (message: string | { text: string; image: unknown }, chartType: string, source: SourceType) => void;
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
      const text = prompt.trim() || generateImagePrompt(chartType);
      onSendMessage({ text, image: selectedImage }, chartType, 'image');
    } else if (fileStatus === 'success' && fileContent) {
      const combined = prompt.trim()
        ? `用户指令：\n${prompt.trim()}\n\n参考内容：\n${fileContent}`
        : fileContent;
      onSendMessage(combined, chartType, 'file');
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

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!['.md', '.txt'].includes(ext)) {
      setFileError('请选择 .md 或 .txt 文件');
      setFileStatus('error');
      return;
    }
    if (file.size > 1024 * 1024) {
      setFileError('文件大小不能超过 1MB');
      setFileStatus('error');
      return;
    }

    setShowImageUpload(false);
    setSelectedFile(file);
    setFileStatus('parsing');
    setFileError('');

    const reader = new FileReader();
    reader.onload = () => {
      const content = ((reader.result as string) || '').trim();
      if (content) {
        setFileContent(content);
        setFileStatus('success');
      } else {
        setFileError('文件内容为空');
        setFileStatus('error');
      }
    };
    reader.onerror = () => {
      setFileError('文件读取失败');
      setFileStatus('error');
    };
    reader.readAsText(file);
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
    const imagePrompt = generateImagePrompt(chartType);
    onSendMessage({ text: imagePrompt, image: selectedImage }, chartType, 'image');
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
          <AppIcon size={22} />
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
            <select
              value={chartType}
              onChange={(e) => setChartType(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-black/4 border border-black/5 rounded-xl text-[var(--fg)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-indigo)]/30 appearance-none cursor-pointer bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748B%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_8px_center] pr-7"
            >
              {Object.entries(CHART_TYPES).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
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
            <select
              value={chartType}
              onChange={(e) => setChartType(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-black/4 border border-black/5 rounded-xl text-[var(--fg)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-indigo)]/30 appearance-none cursor-pointer bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748B%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_8px_center] pr-7"
            >
              {Object.entries(CHART_TYPES).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
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

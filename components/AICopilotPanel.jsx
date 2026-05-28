'use client';

import { useState, useRef, useEffect } from 'react';
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
} from 'lucide-react';
import { AppIcon } from './TopBar';
import { CHART_TYPES } from '@/lib/constants';
import { generateImagePrompt } from '@/lib/image-utils';
import ImageUpload from './ImageUpload';

const SUGGESTION_CHIPS = [
  { icon: FileText, label: '生成架构图' },
  { icon: LayoutGrid, label: '转换为时序图' },
  { icon: Wand2, label: '优化布局' },
  { icon: Sparkles, label: '添加图例' },
];

export default function AICopilotPanel({
  onSendMessage,
  isGenerating,
  currentInput,
  currentChartType,
  onOpenHistory,
  onOpenConfig,
  onExport,
  apiError,
  onClearError,
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [prompt, setPrompt] = useState(currentInput || '');
  const [chartType, setChartType] = useState(currentChartType || 'auto');
  const [showImageUpload, setShowImageUpload] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // File upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [fileStatus, setFileStatus] = useState('');
  const [fileError, setFileError] = useState('');

  // Image upload state
  const [selectedImage, setSelectedImage] = useState(null);

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

  // --- Send ---
  const canSend = () => {
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
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChipClick = (label) => {
    setShowImageUpload(false);
    handleClearFile();
    setPrompt(label);
    setTimeout(() => onSendMessage(label, chartType, 'text'), 50);
  };

  // --- File upload ---
  const handleFileChange = (e) => {
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
      const content = (reader.result || '').trim();
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

  // --- Image upload ---
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

  return (
    <div className="h-full flex flex-col bg-white/65 backdrop-blur-2xl border-r border-white/10 w-[360px] min-w-[360px] relative z-10">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-black/5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <AppIcon size={22} />
          <span className="text-sm font-semibold text-[var(--fg)]">AI 助手</span>
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5 transition-all duration-200"
        >
          <ChevronLeft size={16} />
        </button>
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

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Chart Type */}
        {!showImageUpload && (
          <div className="px-4 pt-4 pb-2">
            <select
              value={chartType}
              onChange={(e) => setChartType(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-black/4 border border-black/5 rounded-xl text-[var(--fg)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-indigo)]/30 appearance-none cursor-pointer"
            >
              {Object.entries(CHART_TYPES).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Text Input or Image Upload */}
        <div className="flex-1 overflow-auto px-4">
          {showImageUpload ? (
            <div className="py-2 min-h-[200px] flex flex-col">
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
                placeholder={(selectedFile || selectedImage) ? '补充指令（可选）...' : '描述你想要创建的图表...'}
                className="w-full resize-none bg-transparent text-sm leading-relaxed text-[var(--fg)] placeholder:text-[var(--muted)]/50 focus:outline-none min-h-[80px]"
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
        <div className="px-4 pb-3 pt-2 flex items-center gap-2">
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
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>生成中</span>
              </>
            ) : (
              <>
                <Send size={13} />
                <span>生成</span>
              </>
            )}
          </button>
        </div>

        {/* Suggestion Chips */}
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
      </div>

      {/* Bottom Actions */}
      <div className="border-t border-black/5 px-4 py-3 flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onOpenHistory}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5 rounded-lg transition-all duration-200"
        >
          <History size={13} />
          <span>历史记录</span>
        </button>
        <button
          onClick={onOpenConfig}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5 rounded-lg transition-all duration-200"
        >
          <Wand2 size={13} />
          <span>配置</span>
        </button>
        <div className="flex-1" />
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5 rounded-lg transition-all duration-200"
        >
          <Download size={13} />
          <span>导出</span>
        </button>
      </div>
    </div>
  );
}

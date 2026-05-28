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
} from 'lucide-react';
import { AppIcon } from './TopBar';
import { CHART_TYPES } from '@/lib/constants';

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
  const [activeTab, setActiveTab] = useState('text'); // text | file | image
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

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

  const handleSend = () => {
    if (!prompt.trim() || isGenerating) return;
    onSendMessage(prompt.trim(), chartType, 'text');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChipClick = (label) => {
    setPrompt(label);
    setTimeout(() => handleSend(), 50);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setPrompt(text);
    setActiveTab('text');
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
    <div className="h-full flex flex-col bg-white/65 backdrop-blur-2xl border-r border-white/10 w-[360px] min-w-[360px]">
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

      {/* Input Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tab Selector */}
        <div className="flex items-center gap-1 px-4 pt-4 pb-2">
          {[
            { key: 'text', label: '文本' },
            { key: 'file', label: '文件' },
            { key: 'image', label: '图片' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => tab.key === 'file' ? fileInputRef.current?.click() : setActiveTab(tab.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                activeTab === tab.key
                  ? 'bg-black/8 text-[var(--fg)]'
                  : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.txt"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>

        {/* Chart Type Selector */}
        <div className="px-4 pb-2">
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

        {/* Textarea */}
        <div className="flex-1 px-4 overflow-auto">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="描述你想要创建的图表..."
            className="w-full resize-none bg-transparent text-sm leading-relaxed text-[var(--fg)] placeholder:text-[var(--muted)]/50 focus:outline-none min-h-[80px]"
          />
        </div>

        {/* Send Button */}
        <div className="px-4 pb-3 flex items-center gap-2">
          <button className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5 transition-all duration-200">
            <Paperclip size={15} />
          </button>
          <button className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5 transition-all duration-200">
            <Image size={15} />
          </button>
          <div className="flex-1" />
          <button
            onClick={handleSend}
            disabled={!prompt.trim() || isGenerating}
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
                <span>发送</span>
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

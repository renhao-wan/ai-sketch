'use client';

import { useState, useCallback, type MouseEvent } from 'react';
import { X } from 'lucide-react';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import type { SourceType, ConversationMessage } from '@/lib/types';
import type { DiagramFormat } from '@/lib/types/diagram-strategy';
import type { GenerationMode } from '@/lib/generation/types';

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
  /** 上下文开关 */
  contextEnabled?: boolean;
  onContextEnabledChange?: (enabled: boolean) => void;
  /** 编辑消息 */
  onEditMessage?: (messageId: string, newContent: string) => void;
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
  contextEnabled = true,
  onContextEnabledChange,
  onEditMessage,
}: AICopilotPanelProps) {
  const [isCollapsedLocal, setIsCollapsedLocal] = useState(false);
  const isCollapsed = collapsedProp ?? isCollapsedLocal;
  const setIsCollapsed = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    setIsCollapsedLocal(prev => {
      const next = typeof value === 'function' ? value(prev) : value;
      onCollapsedChange?.(next);
      return next;
    });
  }, [onCollapsedChange]);

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
      {/* Resize Handle */}
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
      <MessageList
        messages={messages}
        conversationId={conversationId}
        isStreaming={isStreaming}
        isGenerating={isGenerating}
        onRegenerate={onRegenerate}
        onShowDiagram={onShowDiagram}
        onEditMessage={onEditMessage}
      />

      {/* Input Area */}
      <ChatInput
        hasMessages={hasMessages}
        isGenerating={isGenerating}
        currentFormat={currentFormat}
        currentChartType={currentChartType}
        onFormatChange={onFormatChange}
        onChartTypeChange={() => {}}
        onSendMessage={onSendMessage}
        onCancel={onCancel}
        generationMode={generationMode}
        onGenerationModeChange={onGenerationModeChange}
        contextEnabled={contextEnabled}
        onContextEnabledChange={onContextEnabledChange}
      />
    </div>
  );
}

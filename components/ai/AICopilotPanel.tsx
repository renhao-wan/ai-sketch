'use client';

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
  onRegenerate: () => void;
  onShowDiagram: (content: string) => void;
  apiError: string | null;
  onClearError: () => void;
  panelWidth?: number;
  /** 从外部控制面板折叠状态 */
  collapsed?: boolean;
  /** @deprecated 折叠状态已由父组件通过 collapsed prop 控制 */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** 生成模式 */
  generationMode?: GenerationMode;
  onGenerationModeChange?: (mode: GenerationMode) => void;
  /** 上下文开关 */
  contextEnabled?: boolean;
  onContextEnabledChange?: (enabled: boolean) => void;
  /** 需求提取开关 */
  useRequirementExtraction?: boolean;
  onRequirementExtractionChange?: (enabled: boolean) => void;
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
  onRegenerate,
  onShowDiagram,
  apiError,
  onClearError,
  panelWidth = 360,
  collapsed: collapsedProp,
  generationMode = 'auto',
  onGenerationModeChange,
  contextEnabled = true,
  onContextEnabledChange,
  useRequirementExtraction = true,
  onRequirementExtractionChange,
  onEditMessage,
}: AICopilotPanelProps) {
  const isCollapsed = collapsedProp ?? false;

  if (isCollapsed) {
    return (
      <div className="h-full bg-[var(--bg-glass)] backdrop-blur-2xl" style={{ width: 0, minWidth: 0 }} />
    );
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[var(--bg-glass)] backdrop-blur-2xl relative z-10" style={{ width: panelWidth, minWidth: panelWidth }}>

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
        isCollapsed={isCollapsed}
        onRegenerate={onRegenerate}
        onShowDiagram={onShowDiagram}
        onEditMessage={onEditMessage}
      />

      {/* Input Area */}
      <ChatInput
        hasMessages={hasMessages}
        isGenerating={isGenerating}
        currentInput={currentInput}
        currentFormat={currentFormat}
        currentChartType={currentChartType}
        conversationId={conversationId}
        onFormatChange={onFormatChange}
        onSendMessage={onSendMessage}
        onCancel={onCancel}
        generationMode={generationMode}
        onGenerationModeChange={onGenerationModeChange}
        contextEnabled={contextEnabled}
        onContextEnabledChange={onContextEnabledChange}
        useRequirementExtraction={useRequirementExtraction}
        onRequirementExtractionChange={onRequirementExtractionChange}
      />
    </div>
  );
}

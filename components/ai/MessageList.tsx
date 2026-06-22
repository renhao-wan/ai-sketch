'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, ChevronDown } from 'lucide-react';
import MessageBubble from './MessageBubble';
import { useLocale } from '@/lib/locales';
import { exportMessage } from '@/lib/utils/export-message';
import type { ConversationMessage } from '@/lib/types';

interface MessageListProps {
  messages: ConversationMessage[];
  conversationId: string | null;
  isStreaming: boolean;
  isGenerating: boolean;
  /** 用于折叠展开后自动滑底 */
  isCollapsed?: boolean;
  onRegenerate: () => void;
  onShowDiagram: (content: string) => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
}

export default function MessageList({
  messages,
  conversationId,
  isStreaming,
  isGenerating,
  isCollapsed = false,
  onRegenerate,
  onShowDiagram,
  onEditMessage,
}: MessageListProps) {
  const { t } = useLocale();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);
  const prevConvRef = useRef(conversationId);
  const prevCollapsedRef = useRef(isCollapsed);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  // 滑底判断：是否在底部附近（阈值为容器高度的 20%）
  const isNearBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    const threshold = container.clientHeight * 0.2;
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  }, []);

  // 监听滚动事件，控制"回到底部"按钮
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
    setShowScrollToBottom(!atBottom && messages.length > 0);
  }, [messages.length]);

  // 执行滑底
  const scrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  }, []);

  // 消息变化 / 对话切换时的自动滑底
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const convChanged = conversationId !== prevConvRef.current;
    prevConvRef.current = conversationId;

    const isNewMessage = messages.length > prevCountRef.current;
    prevCountRef.current = messages.length;

    if (convChanged || isNewMessage) {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    } else {
      if (isNearBottom()) {
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
        });
      }
    }
  }, [messages, conversationId, isNearBottom]);

  // 对话切换时强制滑底
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }, [conversationId]);

  // 折叠→展开时强制滑底（双层 rAF 确保 DOM 布局稳定）
  useEffect(() => {
    const wasCollapsed = prevCollapsedRef.current;
    prevCollapsedRef.current = isCollapsed;

    if (wasCollapsed && !isCollapsed && messages.length > 0) {
      const container = messagesContainerRef.current;
      if (!container) return;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
        });
      });
    }
  }, [isCollapsed, messages.length]);

  const hasMessages = messages.length > 0;

  if (!hasMessages) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 overflow-auto">
        <div className="relative mb-5">
          <div className="absolute inset-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--accent-indigo)] to-[var(--accent-violet)] blur-xl opacity-30" />
          <div className="relative w-12 h-12 rounded-2xl bg-[var(--accent-indigo)]/10 flex items-center justify-center">
            <Sparkles size={20} className="text-[var(--accent-indigo)]" />
          </div>
        </div>
        <p className="text-sm font-semibold text-[var(--fg)] mb-1 tracking-tight">{t('copilot.aiChartAssistant')}</p>
        <p className="text-xs text-[var(--muted)] text-center leading-relaxed">{t('copilot.describeChart')}</p>
      </div>
    );
  }

  return (
    <div ref={messagesContainerRef} onScroll={handleScroll} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4 scrollbar-subtle bg-[var(--surface-warm)]/30">
      {messages.map((msg, idx) => {
        const isLastAssistant = msg.role === 'assistant' && idx === messages.length - 1;
        const isAssistant = msg.role === 'assistant';
        const isMsgStreaming = isStreaming && msg.role === 'assistant' && msg.id === messages[messages.length - 1]?.id;
        const isLastUser = msg.role === 'user' && !isGenerating && !isMsgStreaming && onEditMessage
          && !messages.slice(idx + 1).some(m => m.role === 'user');
        return (
          <MessageBubble
            key={msg.id}
            message={msg}
            isStreaming={isMsgStreaming}
            onRegenerate={isLastAssistant && !isGenerating ? onRegenerate : undefined}
            onCopy={isAssistant && !isMsgStreaming ? () => navigator.clipboard.writeText(msg.content) : undefined}
            onExport={isAssistant && !isMsgStreaming ? () => exportMessage(msg.content) : undefined}
            onShowDiagram={isAssistant && !isMsgStreaming ? () => onShowDiagram(msg.content) : undefined}
            onEdit={isLastUser ? (newContent) => onEditMessage(msg.id, newContent) : undefined}
          />
        );
      })}
      <div ref={messagesEndRef} />

      {showScrollToBottom && (
        <button
          onClick={scrollToBottom}
          className="sticky bottom-3 left-1/2 -translate-x-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-white/90 backdrop-blur-sm border border-[var(--border)] shadow-lg hover:bg-white hover:shadow-xl active:scale-95 transition-all duration-200 z-10"
          title={t('copilot.scrollToBottom')}
        >
          <ChevronDown size={16} className="text-[var(--fg)]" />
        </button>
      )}
    </div>
  );
}

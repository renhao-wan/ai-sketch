'use client';

import { useState, useCallback } from 'react';
import * as api from '@/lib/api/client';
import type { ConversationMessage } from '@/lib/types';
import type { DiagramFormat } from '@/lib/types/diagram-strategy';

interface UseConversationOptions {
  onFormatChange?: (format: DiagramFormat) => void;
  onCodeClear?: () => void;
}

/**
 * 会话管理 Hook
 * 管理会话 ID、消息列表、会话加载/创建
 */
export function useConversation(options: UseConversationOptions = {}) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);

  const loadConversation = useCallback(async (id: string) => {
    try {
      const conv = await api.getConversation(id);
      setConversationId(conv.id);
      setMessages(conv.messages);

      if (conv.format && ['excalidraw', 'mermaid', 'drawio'].includes(conv.format)) {
        options.onFormatChange?.(conv.format as DiagramFormat);
      }

      options.onCodeClear?.();
    } catch (err) {
      console.error('Failed to load conversation:', err);
      throw err;
    }
  }, [options]);

  const newConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    options.onCodeClear?.();
    options.onFormatChange?.('excalidraw');
  }, [options]);

  const addUserMessage = useCallback((msg: ConversationMessage) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  const addAssistantPlaceholder = useCallback((placeholder: ConversationMessage) => {
    setMessages(prev => [...prev, placeholder]);
    return placeholder.id;
  }, []);

  const updateMessage = useCallback((id: string, updates: Partial<ConversationMessage>) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  }, []);

  const updateMessagesConversationId = useCallback((oldIds: string[], newConvId: string) => {
    setMessages(prev => prev.map(m =>
      oldIds.includes(m.id) ? { ...m, conversationId: newConvId } : m
    ));
  }, []);

  const removeLastAssistantMessage = useCallback(() => {
    setMessages(prev => {
      const lastAssistantIdx = [...prev].reverse().findIndex(m => m.role === 'assistant');
      if (lastAssistantIdx === -1) return prev;
      const idx = prev.length - 1 - lastAssistantIdx;
      return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
    });
  }, []);

  return {
    conversationId,
    setConversationId,
    messages,
    setMessages,
    loadConversation,
    newConversation,
    addUserMessage,
    addAssistantPlaceholder,
    updateMessage,
    updateMessagesConversationId,
    removeLastAssistantMessage,
  };
}

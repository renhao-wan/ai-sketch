'use client';

import { useState, useMemo, useCallback } from 'react';
import { detectCodeFormat } from '@/lib/utils/detect-code-format';
import type { ConversationMessage } from '@/lib/types';
import type { VersionItem } from '@/components/version-history/VersionHistoryDrawer';

interface UseVersionHistoryOptions {
  messages: ConversationMessage[];
  onShowDiagram: (content: string) => void;
}

export function useVersionHistory({ messages, onShowDiagram }: UseVersionHistoryOptions) {
  const [versionDrawerOpen, setVersionDrawerOpen] = useState(false);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);

  // 从 messages 中提取 assistant 消息作为版本列表
  const versions: VersionItem[] = useMemo(() =>
    messages
      .filter(msg => msg.role === 'assistant')
      .map((msg, index) => ({
        id: msg.id,
        versionNumber: index + 1,
        createdAt: msg.createdAt,
        code: msg.content,
        format: detectCodeFormat(msg.content),
      })),
    [messages]
  );

  // 版本列表变化时清空当前版本选择
  // 使用 useMemo 派生有效值，避免在 effect 中调用 setState
  const effectiveVersionId = useMemo(() => {
    if (!currentVersionId) return null;
    const exists = versions.some(v => v.id === currentVersionId);
    return exists ? currentVersionId : null;
  }, [currentVersionId, versions]);

  const handleSelectVersion = useCallback((versionId: string) => {
    const msg = messages.find(m => m.id === versionId);
    if (!msg) return;
    onShowDiagram(msg.content);
    setCurrentVersionId(versionId);
  }, [messages, onShowDiagram]);

  const handleCloseVersionDrawer = useCallback(() => {
    setVersionDrawerOpen(false);
  }, []);

  const toggleVersionDrawer = useCallback(() => {
    setVersionDrawerOpen(prev => !prev);
  }, []);

  return {
    versions,
    versionDrawerOpen,
    currentVersionId: effectiveVersionId,
    handleSelectVersion,
    handleCloseVersionDrawer,
    toggleVersionDrawer,
  };
}

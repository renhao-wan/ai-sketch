'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  GitBranch,
  Wand2,
  Tag,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { AppIcon } from '@/components/layout/TopBar';
import ConversationList from '@/components/ai/ConversationList';
import WindowControls from '@/components/layout/WindowControls';
import TagBadge from '@/components/ui/TagBadge';
import Tooltip from '@/components/ui/Tooltip';
import { useLocale } from '@/lib/locales';
import * as api from '@/lib/api/client';
import type { ConversationTag } from '@/lib/types';

interface EditorTopBarProps {
  onGoHome: () => void;
  conversationId: string | null;
  onLoadConversation: (id: string) => void;
  onNewConversation: () => void;
  onOpenConfig: () => void;
  onVersionHistory: () => void;
}

export default function EditorTopBar({
  onGoHome,
  conversationId,
  onLoadConversation,
  onNewConversation,
  onOpenConfig,
  onVersionHistory,
}: EditorTopBarProps) {
  const { t } = useLocale();

  // 标签选择器状态
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [conversationTags, setConversationTags] = useState<ConversationTag[]>([]);
  const [allConvTags, setAllConvTags] = useState<ConversationTag[]>([]);
  const tagBtnRef = useRef<HTMLButtonElement>(null);
  const tagMenuRef = useRef<HTMLDivElement>(null);
  const [tagMenuPos, setTagMenuPos] = useState({ top: 0, left: 0 });

  // 加载所有对话标签
  useEffect(() => {
    api.fetchConversationTags().then(setAllConvTags).catch(() => {});
  }, []);

  // 加载当前对话的标签
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 对话切换时重置标签
    if (!conversationId) { setConversationTags([]); return; }
    api.fetchConversationTagsByIds(conversationId).then(setConversationTags).catch(() => {});
  }, [conversationId]);

  // 标签展开时重新计算菜单位置
  useEffect(() => {
    if (!showTagSelector || !tagBtnRef.current) return;
    const rect = tagBtnRef.current.getBoundingClientRect();
    const menuWidth = 224;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8));
    setTagMenuPos({ top: rect.bottom + 4, left });
  }, [showTagSelector]);

  // 标签选择器点击外部关闭
  useEffect(() => {
    if (!showTagSelector) return;
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      const target = e.target as Node;
      if (tagBtnRef.current?.contains(target)) return;
      if (tagMenuRef.current?.contains(target)) return;
      setShowTagSelector(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTagSelector]);

  // 标签变更
  const handleTagChange = useCallback(async (tagIds: string[]) => {
    if (!conversationId) return;
    try {
      const result = await api.setConversationTags(conversationId, tagIds);
      setConversationTags(result.tags);
    } catch (err) {
      console.error('Failed to update conversation tags:', err);
    }
  }, [conversationId]);

  return (
    <div
      className="flex items-center justify-between px-6 h-14 bg-[var(--bg-glass)] backdrop-blur-xl border-b border-[var(--border)] flex-shrink-0 relative z-20"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* 左侧：Logo + 会话列表 */}
      <div className="flex items-center gap-2.5 min-w-0" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <Tooltip content={t('copilot.backHome')} side="bottom">
          <button
            onClick={onGoHome}
            className="hover:opacity-80 transition-opacity duration-200 relative"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-indigo)] to-[var(--accent-violet)] rounded-lg blur-md opacity-20" />
            <div className="relative"><AppIcon size={22} /></div>
          </button>
        </Tooltip>
        <ConversationList
          currentId={conversationId}
          onSelect={onLoadConversation}
          onNew={onNewConversation}
        />
      </div>

      {/* 右侧：标签 + 配置 + 版本历史 + 窗口控制 */}
      <div className="flex items-center gap-1 flex-shrink-0" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {/* 标签按钮 */}
        <div className="relative">
          <Tooltip content={t('copilot.tags')} side="bottom">
            <button
              ref={tagBtnRef}
              onClick={() => setShowTagSelector(prev => !prev)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 ${
                showTagSelector
                  ? 'text-[var(--accent-indigo)] bg-[var(--accent-indigo)]/10'
                  : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)]'
              }`}
            >
              <Tag size={16} />
              {conversationTags.length > 0 && !showTagSelector && (
                <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center text-[9px] font-medium text-white bg-[var(--accent-indigo)] rounded-full">
                  {conversationTags.length}
                </span>
              )}
            </button>
          </Tooltip>
          {/* 标签选择器下拉 */}
          {showTagSelector && createPortal(
            <div
              ref={tagMenuRef}
              className="fixed z-[200] w-56 bg-[var(--surface-warm)] backdrop-blur-xl rounded-xl border border-[var(--border)] shadow-[0_8px_30px_rgba(28,25,23,0.12)]"
              style={{ top: tagMenuPos.top, left: tagMenuPos.left }}
            >
              {!conversationId ? (
                <div className="px-4 py-5 text-center text-xs text-[var(--muted)]">
                  {t('copilot.sendFirst')}
                </div>
              ) : (
                <div className="p-4">
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto scrollbar-thin pt-1">
                    {allConvTags.length === 0 ? (
                      <div className="w-full text-center py-4 text-xs text-[var(--muted)]">{t('tags.noTags')}</div>
                    ) : allConvTags.map(tag => (
                      <TagBadge
                        key={tag.id}
                        name={tag.name}
                        color={tag.color}
                        size="md"
                        selected={conversationTags.some(ct => ct.id === tag.id)}
                        onClick={() => {
                          const ids = conversationTags.some(ct => ct.id === tag.id)
                            ? conversationTags.filter(ct => ct.id !== tag.id).map(ct => ct.id)
                            : [...conversationTags.map(ct => ct.id), tag.id];
                          handleTagChange(ids);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>,
            document.body,
          )}
        </div>

        {/* 配置按钮 */}
        <Tooltip content={t('copilot.config')} side="bottom">
          <button
            onClick={onOpenConfig}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200"
          >
            <Wand2 size={16} />
          </button>
        </Tooltip>

        {/* 版本历史按钮 */}
        <Tooltip content={t('versionHistory.title')} side="bottom">
          <button
            onClick={onVersionHistory}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200"
          >
            <GitBranch size={16} />
          </button>
        </Tooltip>

        {/* 窗口控制（仅 Electron） */}
        <WindowControls />
      </div>
    </div>
  );
}

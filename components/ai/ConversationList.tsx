'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Trash2, ChevronDown, Pencil, Check, X, Search, ArrowUpDown } from 'lucide-react';
import * as api from '@/lib/api-client';
import { useLocale } from '@/locales';
import { timeAgo } from '@/lib/time-ago';
import Tooltip from '@/components/ui/Tooltip';
import type { Conversation } from '@/types';
import type { DiagramFormat } from '@/types/diagram-strategy';

interface ConversationListProps {
  currentId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

const FORMAT_BADGES: Record<DiagramFormat, { label: string; color: string }> = {
  excalidraw: { label: 'EX', color: 'bg-purple-500/10 text-purple-600' },
  mermaid: { label: 'MM', color: 'bg-blue-500/10 text-blue-600' },
  drawio: { label: 'DX', color: 'bg-orange-500/10 text-orange-600' },
};

export default function ConversationList({ currentId, onSelect, onDelete, onNew }: ConversationListProps) {
  const { t } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // 搜索、排序、分页状态
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'updated_at' | 'created_at'>('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const loadConversations = async (reset = false, pageNum = 0) => {
    try {
      const offset = pageNum * 20;
      const result = await api.fetchConversations({
        search: searchQuery || undefined,
        sort: sortBy,
        order: sortOrder,
        limit: 20,
        offset,
      });

      if (reset) {
        setConversations(result.conversations);
      } else {
        setConversations(prev => [...prev, ...result.conversations]);
      }

      setTotalCount(result.total);
      setHasMore(result.hasMore);
    } catch (err) {
      console.error('加载会话失败:', err);
    }
  };

  // 防抖搜索效果：搜索词、排序方式变化时自动重新加载
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      setPage(0);
      loadConversations(true, 0);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, searchQuery, sortBy, sortOrder]);

  const loadMore = async () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    const nextPage = page + 1;
    await loadConversations(false, nextPage);
    setPage(nextPage);
    setIsLoadingMore(false);
  };

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 50 && hasMore && !isLoadingMore) {
      loadMore();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, isLoadingMore]);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await api.deleteConversation(id);
    onDelete(id);
    await loadConversations(true, 0);
  };

  const handleRenameStart = (e: React.MouseEvent, conv: Conversation) => {
    e.stopPropagation();
    setRenamingId(conv.id);
    setRenameValue(conv.title);
  };

  const handleRenameSave = async () => {
    if (!renamingId || !renameValue.trim()) { setRenamingId(null); return; }
    await api.updateConversationTitle(renamingId, renameValue.trim());
    setRenamingId(null);
    await loadConversations(true, 0);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRenameSave();
    if (e.key === 'Escape') setRenamingId(null);
  };

  const current = conversations.find(c => c.id === currentId);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] rounded-lg transition-all duration-200"
      >
        <MessageSquare size={13} />
        <span className="max-w-[120px] truncate">{current?.title || t('conversation.list')}</span>
        <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 w-72 bg-[var(--surface-warm)] backdrop-blur-xl rounded-2xl border border-[var(--border)] shadow-[0_10px_40px_rgba(28,25,23,0.10)] overflow-hidden animate-slide-up">
            {/* New chat button */}
            <button
              onClick={() => { onNew(); setIsOpen(false); }}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-[var(--accent-indigo)] hover:bg-[var(--accent-indigo)]/5 transition-colors border-b border-black/5"
            >
              <MessageSquare size={14} />
              {t('conversation.new')}
            </button>

            {/* Search and sort controls */}
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-black/5">
              <div className="flex-1 relative">
                <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('conversation.search') || '搜索会话...'}
                  className="w-full pl-7 pr-2 py-1.5 text-xs text-[var(--fg)] bg-white/50 border border-[var(--border)] rounded-lg outline-none focus:border-[var(--accent-indigo)] focus:ring-1 focus:ring-[var(--accent-indigo)]/20 placeholder:text-[var(--muted)]"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
                }}
                className="p-1.5 text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5 rounded-md transition-colors flex-shrink-0"
                title={sortOrder === 'desc' ? '降序' : '升序'}
              >
                <ArrowUpDown size={13} className={sortOrder === 'asc' ? 'rotate-180' : ''} />
              </button>
            </div>

            {/* List */}
            <div className="max-h-64 overflow-y-auto scrollbar-thin" onScroll={handleScroll}>
              {conversations.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-[var(--muted)]">
                  {searchQuery ? '未找到匹配的会话' : t('conversation.empty')}
                </div>
              ) : (
                conversations.map((conv) => {
                  const badge = FORMAT_BADGES[conv.format] || FORMAT_BADGES.excalidraw;
                  const isRenaming = renamingId === conv.id;
                  return (
                    <div
                      key={conv.id}
                      onClick={() => { if (!isRenaming) { onSelect(conv.id); setIsOpen(false); } }}
                      className={`group flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                        conv.id === currentId ? 'bg-[var(--accent-indigo)]/5' : 'hover:bg-[var(--surface-warm-hover)]'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        {isRenaming ? (
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <input
                              ref={renameInputRef}
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={handleRenameKeyDown}
                              className="flex-1 min-w-0 text-sm text-[var(--fg)] bg-white border border-[var(--accent-indigo)]/30 rounded-md px-2 py-0.5 outline-none focus:border-[var(--accent-indigo)] focus:ring-1 focus:ring-[var(--accent-indigo)]/20"
                            />
                            <button onClick={handleRenameSave} className="p-1 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors">
                              <Check size={14} />
                            </button>
                            <button onClick={() => setRenamingId(null)} className="p-1 text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5 rounded transition-colors">
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${badge.color}`}>
                                {badge.label}
                              </span>
                              <span className="text-sm text-[var(--fg)] truncate">{conv.title}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
                              <span>{conv.messageCount} {t('conversation.messages')}</span>
                              <span>{timeAgo(conv.updatedAt, t)}</span>
                            </div>
                          </>
                        )}
                      </div>
                      {!isRenaming && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Tooltip content={t('conversation.rename')} side="top">
                            <button
                              onClick={(e) => handleRenameStart(e, conv)}
                              className="p-1.5 text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5 rounded-md transition-colors"
                            >
                              <Pencil size={13} />
                            </button>
                          </Tooltip>
                          <button
                            onClick={(e) => handleDelete(e, conv.id)}
                            className="p-1.5 text-[var(--muted)] hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              {/* 无限滚动加载指示器 */}
              {isLoadingMore && (
                <div className="px-4 py-2 text-center text-xs text-[var(--muted)]">
                  加载中...
                </div>
              )}
              {!hasMore && conversations.length > 0 && totalCount > 0 && (
                <div className="px-4 py-1.5 text-center text-[10px] text-[var(--muted)]">
                  共 {totalCount} 条会话
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, ChevronDown, Loader2 } from 'lucide-react';
import * as api from '@/lib/api/client';
import { useLocale } from '@/lib/locales';
import { timeAgo } from '@/lib/utils/time-ago';
import type { Conversation } from '@/lib/types';
import type { DiagramFormat } from '@/lib/types/diagram-strategy';

interface ConversationListProps {
  currentId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

const PAGE_SIZE = 20;

const FORMAT_BADGES: Record<DiagramFormat, { label: string; color: string }> = {
  excalidraw: { label: 'EX', color: 'bg-[var(--accent-violet)]/10 text-[var(--accent-violet)]' },
  mermaid: { label: 'MM', color: 'bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)]' },
  drawio: { label: 'DX', color: 'bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)]' },
};

/** 会话列表 — 快速切换当前会话，支持滚动加载更多 */
export default function ConversationList({ currentId, onSelect, onNew }: ConversationListProps) {
  const { t } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);

  /** 加载会话（首次 or 加载更多） */
  const loadConversations = useCallback(async (reset: boolean) => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const offset = reset ? 0 : offsetRef.current;
      const result = await api.fetchConversations({ limit: PAGE_SIZE, offset });
      setConversations(prev => reset ? result.conversations : [...prev, ...result.conversations]);
      setHasMore(result.hasMore);
      offsetRef.current = offset + result.conversations.length;
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  /** 打开下拉时重置加载 */
  useEffect(() => {
    if (isOpen) {
      offsetRef.current = 0;
      setHasMore(true);
      loadConversations(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadConversations 不应在依赖中，避免打开下拉时无限循环
  }, [isOpen]);

  /** 滚动到底部时加载更多 */
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el || isLoading || !hasMore) return;
    // 距底部 40px 时触发
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 40) {
      loadConversations(false);
    }
  }, [isLoading, hasMore, loadConversations]);

  const current = conversations.find(c => c.id === currentId);

  return (
    <div className="relative flex-1 min-w-[60px] max-w-[160px]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] rounded-lg transition-all duration-200 w-full"
      >
        <MessageSquare size={13} className="flex-shrink-0" />
        <span className="flex-1 min-w-0 truncate text-left">{current?.title || t('conversation.list')}</span>
        <ChevronDown size={12} className={`flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40 cursor-pointer" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 w-72 bg-[var(--surface-warm)] backdrop-blur-xl rounded-2xl border border-[var(--border)] shadow-[0_10px_40px_rgba(28,25,23,0.10)] overflow-hidden animate-slide-up">
            {/* New chat button */}
            <button
              onClick={() => { onNew(); setIsOpen(false); }}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-[var(--accent-indigo)] hover:bg-[var(--accent-indigo)]/5 transition-colors border-b border-black/5"
            >
              <MessageSquare size={14} />
              {t('conversation.new')}
            </button>

            {/* List */}
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="max-h-64 overflow-y-auto scrollbar-thin"
            >
              {conversations.length === 0 && !isLoading ? (
                <div className="px-4 py-6 text-center text-sm text-[var(--muted)]">{t('conversation.empty')}</div>
              ) : (
                <>
                  {conversations.map((conv) => {
                    const badge = FORMAT_BADGES[conv.format] || FORMAT_BADGES.excalidraw;
                    return (
                      <div
                        key={conv.id}
                        onClick={() => { onSelect(conv.id); setIsOpen(false); }}
                        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                          conv.id === currentId ? 'bg-[var(--accent-indigo)]/5' : 'hover:bg-[var(--surface-warm-hover)]'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
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
                        </div>
                      </div>
                    );
                  })}
                  {/* 底部加载指示器 */}
                  {isLoading && (
                    <div className="flex items-center justify-center py-3">
                      <Loader2 size={16} className="animate-spin text-[var(--muted)]" />
                    </div>
                  )}
                  {!hasMore && conversations.length > 0 && (
                    <div className="py-2 text-center text-[11px] text-[var(--muted)]/60">— {t('conversation.noMore')} —</div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

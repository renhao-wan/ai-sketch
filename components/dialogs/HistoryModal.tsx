'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import * as api from '@/lib/api/client';
import ScrollToTop from '@/components/ui/ScrollToTop';
import Dropdown from '@/components/ui/Dropdown';
import { useLocale } from '@/lib/locales';
import { Clock, ArrowRight, Search } from 'lucide-react';
import type { Conversation } from '@/lib/types';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply?: (conversation: Conversation) => void;
}

const PAGE_SIZE = 20;

/** 历史记录弹窗 — 快速浏览和恢复会话 */
export default function HistoryModal({ isOpen, onClose, onApply }: HistoryModalProps) {
  const { t } = useLocale();
  const [items, setItems] = useState<Conversation[]>([]);

  // Search, sort, pagination state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'updated_at' | 'created_at'>('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const pageRef = useRef(0);

  /** Load conversations with search/sort/pagination support */
  const loadConversations = async (reset = false, pageNum = 0) => {
    try {
      const offset = pageNum * PAGE_SIZE;
      const result = await api.fetchConversations({
        search: searchQuery || undefined,
        sort: sortBy,
        order: sortOrder,
        limit: PAGE_SIZE,
        offset,
      });

      if (reset) {
        setItems(result.conversations);
      } else {
        setItems(prev => [...prev, ...result.conversations]);
      }

      setTotalCount(result.total);
      setHasMore(result.hasMore);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  // Debounced load on open/search/sort changes
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      pageRef.current = 0;
      setHasMore(true);
      loadConversations(true, 0);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, searchQuery, sortBy, sortOrder]);

  /** Infinite scroll: load next page when near bottom */
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const nextPage = pageRef.current + 1;
      await loadConversations(false, nextPage);
      pageRef.current = nextPage;
    } finally {
      setIsLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingMore, hasMore]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 50 && hasMore && !isLoadingMore) {
      loadMore();
    }
  }, [hasMore, isLoadingMore, loadMore]);

  const handleApply = (item: Conversation) => { onApply?.(item); onClose(); };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--bg-glass)] backdrop-blur-2xl rounded-3xl border border-[var(--border)] shadow-[var(--shadow-floating)] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-6 pb-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-[var(--muted)]" />
            <h2 className="text-lg font-semibold tracking-tight text-[var(--fg)]">{t('history.title')}</h2>
            {totalCount > 0 && (
              <span className="text-xs text-[var(--muted)] bg-[var(--surface-warm-hover)] px-2 py-0.5 rounded-full">{totalCount}</span>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Search and Sort Controls */}
        <div className="px-7 pb-3 flex-shrink-0">
          {/* Search Input */}
          <div className="relative mb-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]/50" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('conversation.search')}
              className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--surface-warm-hover)] border border-[var(--surface-warm-hover)] rounded-xl text-[var(--fg)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent-indigo)]/30 transition-all duration-200"
            />
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted)]">{t('conversation.sortBy')}:</span>
            <Dropdown
              options={[
                { value: 'updated_at-desc', label: t('conversation.recentlyUpdated') },
                { value: 'updated_at-asc', label: t('conversation.oldestUpdated') },
                { value: 'created_at-desc', label: t('conversation.recentlyCreated') },
                { value: 'created_at-asc', label: t('conversation.oldestCreated') },
              ]}
              value={`${sortBy}-${sortOrder}`}
              onChange={(v) => {
                const [sort, order] = v.split('-');
                setSortBy((sort || 'updated_at') as 'updated_at' | 'created_at');
                setSortOrder((order || 'desc') as 'asc' | 'desc');
              }}
              className="!py-1.5 !px-3 !text-xs !rounded-lg"
            />
          </div>
        </div>

        {/* Scrollable List */}
        <ScrollToTop className="px-7 pb-6 scrollbar-thin" onScroll={handleScroll}>
          <div className="space-y-2">
            {items.length === 0 ? (
              <div className="text-center py-12 text-sm text-[var(--muted)]">
                {searchQuery ? t('conversation.noResults') : t('history.empty')}
              </div>
            ) : (
              items.map((item) => (
                <div key={item.id} className="group p-4 rounded-2xl bg-[var(--surface-warm-hover)] hover:bg-[var(--border)] border border-transparent hover:border-[var(--border)] transition-all duration-200 cursor-pointer" onClick={() => handleApply(item)}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="px-2 py-0.5 text-[11px] font-medium bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)] rounded-lg">
                          {item.format}
                        </span>
                        <span className="text-[11px] text-[var(--muted)]">
                          {new Date(item.updatedAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--fg)] mb-1">{item.title}</p>
                      {item.configName && <p className="text-[11px] text-[var(--muted)]">{t('history.modelPrefix')} {item.configName} - {item.configModel}</p>}
                    </div>
                    <div className="flex items-center gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button onClick={(e) => { e.stopPropagation(); handleApply(item); }} className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-[var(--accent-indigo)] hover:bg-[var(--accent-indigo)]/10 rounded-lg transition-colors">
                        <ArrowRight size={13} /><span>{t('history.apply')}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Infinite scroll loading indicator */}
            {hasMore && items.length > 0 && (
              <div className="px-4 py-3 text-center">
                <span className="text-xs text-[var(--muted)]">
                  {isLoadingMore ? t('conversation.loading') : t('conversation.loadMore')}
                </span>
              </div>
            )}

            {/* Total count display when all loaded */}
            {!hasMore && items.length > 0 && totalCount > 0 && (
              <div className="px-4 py-2 text-center">
                <span className="text-xs text-[var(--muted)]">
                  {t('conversation.countTotal').replace('{count}', String(totalCount))}
                </span>
              </div>
            )}
          </div>
        </ScrollToTop>
      </div>
    </div>
  );
}

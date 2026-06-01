'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import * as api from '@/lib/api-client';
import ConfirmDialog from '@/components/dialogs/ConfirmDialog';
import Notification from '@/components/Notification';
import ScrollToTop from '@/components/ScrollToTop';
import Dropdown from '@/components/ui/Dropdown';
import { useLocale } from '@/locales';
import Tooltip from '@/components/ui/Tooltip';
import { Trash2, Search, Edit3, Check, X } from 'lucide-react';
import type { Conversation, ConfirmDialogState, NotificationState } from '@/types';

const PAGE_SIZE = 20;

/** 会话管理组件 — 搜索、排序、重命名、删除 */
export default function ConversationSettings() {
  const { t } = useLocale();

  // ── Conversation list state ──
  const [items, setItems] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'updated_at' | 'created_at'>('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const pageRef = useRef(0);

  // ── Rename state ──
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // ── Confirm dialog ──
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
  });

  // ── Notification ──
  const [notification, setNotification] = useState<NotificationState>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  /** Load conversations with search/sort/pagination support */
  const loadConversations = useCallback(async (reset = false, pageNum = 0) => {
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
  }, [searchQuery, sortBy, sortOrder]);

  // Debounced load on search/sort changes
  useEffect(() => {
    const timer = setTimeout(() => {
      pageRef.current = 0;
      setHasMore(true);
      loadConversations(true, 0);
    }, 300);
    return () => clearTimeout(timer);
  }, [loadConversations]);

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
  }, [isLoadingMore, hasMore, loadConversations]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 50 && hasMore && !isLoadingMore) {
      loadMore();
    }
  }, [hasMore, isLoadingMore, loadMore]);

  /** Show a notification toast */
  const showNotification = useCallback((type: NotificationState['type'], message: string) => {
    setNotification({ isOpen: true, title: '', message, type });
  }, []);

  /** Start editing a conversation title */
  const handleStartRename = (item: Conversation) => {
    setEditingId(item.id);
    setEditingTitle(item.title);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  /** Save renamed title */
  const handleSaveRename = async () => {
    if (!editingId || !editingTitle.trim()) {
      setEditingId(null);
      return;
    }

    try {
      await api.updateConversationTitle(editingId, editingTitle.trim());
      setItems(prev => prev.map(item =>
        item.id === editingId ? { ...item, title: editingTitle.trim() } : item
      ));
      showNotification('success', t('conversation.renameSuccess'));
    } catch (err) {
      console.error('Rename failed:', err);
      showNotification('error', t('conversation.renameFailed'));
    } finally {
      setEditingId(null);
    }
  };

  /** Cancel rename */
  const handleCancelRename = () => {
    setEditingId(null);
    setEditingTitle('');
  };

  /** Delete a single conversation */
  const handleDelete = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: t('history.confirmDelete'),
      message: t('history.confirmDeleteMsg'),
      onConfirm: async () => {
        try {
          await api.deleteConversation(id);
          pageRef.current = 0;
          await loadConversations(true, 0);
          showNotification('success', t('conversation.deleteSuccess'));
        } catch (err) {
          console.error('Delete conversation failed:', err);
          showNotification('error', t('conversation.deleteFailed'));
        }
      },
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* 固定头部：搜索和排序 */}
      <div className="flex-shrink-0 space-y-3 mb-4">
        <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]/50" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('conversation.search')}
            className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--surface-warm-hover)] border border-[var(--surface-warm-hover)] rounded-xl text-[var(--fg)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent-indigo)]/30 transition-all duration-200"
          />
        </div>
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
          className="!py-2 !px-3 !text-sm !rounded-xl"
        />
      </div>

        {/* Total count */}
        {totalCount > 0 && (
          <p className="text-xs text-[var(--muted)]">
            {t('conversation.countTotal').replace('{count}', String(totalCount))}
          </p>
        )}
      </div>

      {/* 可滚动的会话列表 */}
      <ScrollToTop className="flex-1 overflow-y-auto scrollbar-thin pt-2" onScroll={handleScroll}>
        <div className="space-y-2">
          {items.length === 0 ? (
            <div className="text-center py-12 text-sm text-[var(--muted)]">
              {searchQuery ? t('conversation.noResults') : t('history.empty')}
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="group p-4 rounded-2xl bg-[var(--surface-warm-hover)] border border-transparent hover:border-[var(--border)] transition-all duration-200">
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
                    {editingId === item.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          ref={editInputRef}
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename();
                            if (e.key === 'Escape') handleCancelRename();
                          }}
                          className="flex-1 px-2 py-1 text-sm bg-[var(--surface-warm)] border border-[var(--accent-indigo)]/30 rounded-lg text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-indigo)]/30"
                        />
                        <button
                          onClick={handleSaveRename}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--accent-indigo)] hover:bg-[var(--accent-indigo)]/10 transition-colors"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={handleCancelRename}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-warm-hover)] transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-[var(--fg)] mb-1">{item.title}</p>
                    )}
                    {item.configName && (
                      <p className="text-[11px] text-[var(--muted)]">
                        {t('history.modelPrefix')} {item.configName} - {item.configModel}
                      </p>
                    )}
                  </div>
                  {editingId !== item.id && (
                    <div className="flex items-center gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <Tooltip content={t('conversation.rename')} side="top">
                        <button
                          onClick={() => handleStartRename(item)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm)] rounded-lg transition-colors"
                        >
                          <Edit3 size={13} />
                        </button>
                      </Tooltip>
                      <Tooltip content={t('common.delete')} side="top">
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </Tooltip>
                    </div>
                  )}
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
        </div>
      </ScrollToTop>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={() => {
          confirmDialog.onConfirm?.();
          setConfirmDialog({ ...confirmDialog, isOpen: false });
        }}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type="danger"
      />

      {/* Notification Toast */}
      <Notification
        isOpen={notification.isOpen}
        onClose={() => setNotification({ ...notification, isOpen: false })}
        title={notification.title || undefined}
        message={notification.message}
        type={notification.type}
      />
    </div>
  );
}

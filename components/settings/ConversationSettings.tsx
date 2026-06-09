'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import * as api from '@/lib/api/client';
import ConfirmDialog from '@/components/dialogs/ConfirmDialog';
import ScrollToTop from '@/components/ui/ScrollToTop';
import Dropdown from '@/components/ui/Dropdown';
import { useLocale } from '@/lib/locales';
import Tooltip from '@/components/ui/Tooltip';
import { useNotification } from '@/lib/contexts/NotificationContext';
import { Trash2, Search, Edit3, Check, X, ChevronDown, ChevronUp, ListChecks, Tag } from 'lucide-react';
import CountBanner from '@/components/ui/CountBanner';
import { useCountBanner } from '@/hooks/useCountBanner';
import TagBadge from '@/components/ui/TagBadge';
import TagFilter from '@/components/ui/TagFilter';
import TagCloudSelector from '@/components/ui/TagCloudSelector';
import type { Conversation, ConversationTag, ConfirmDialogState } from '@/lib/types';

const PAGE_SIZE = 20;

/** 会话管理组件 — 搜索、排序、重命名、删除（支持多种删除方式） */
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

  // ── Count banner ──
  const { showBanner, handleDismissBanner } = useCountBanner({
    count: totalCount,
    threshold: 50,
    storageKey: 'conversation-settings-banner-dismissed',
  });

  // ── Batch operations state ──
  const [showBatchPanel, setShowBatchPanel] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [keepCount, setKeepCount] = useState('');

  // ── Rename state ──
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // ── Tag state ──
  const [tags, setTags] = useState<ConversationTag[]>([]);
  const [conversationTagsMap, setConversationTagsMap] = useState<Record<string, ConversationTag[]>>({});
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [showTagSelector, setShowTagSelector] = useState<string | null>(null);

  // ── Confirm dialog ──
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
  });

  // ── Notification ──
  const { showNotification } = useNotification();

  /** Load conversations with search/sort/pagination/tag support */
  const loadConversations = useCallback(async (reset = false, pageNum = 0) => {
    try {
      const offset = pageNum * PAGE_SIZE;
      const result = await api.fetchConversations({
        search: searchQuery || undefined,
        sort: sortBy,
        order: sortOrder,
        limit: PAGE_SIZE,
        offset,
        tagId: selectedTagId || undefined,
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
  }, [searchQuery, sortBy, sortOrder, selectedTagId]);

  // Debounced load on search/sort/tag changes
  useEffect(() => {
    const timer = setTimeout(() => {
      pageRef.current = 0;
      setHasMore(true);
      loadConversations(true, 0);
    }, 300);
    return () => clearTimeout(timer);
  }, [loadConversations]);

  /** Load all conversation tags */
  useEffect(() => {
    const loadTags = async () => {
      try {
        const convTags = await api.fetchConversationTags();
        setTags(convTags);
      } catch (err) {
        console.error('Failed to load tags:', err);
      }
    };
    loadTags();
  }, []);

  /** Load tags for visible conversations */
  useEffect(() => {
    if (items.length === 0) return;
    const loadConversationTags = async () => {
      const tagsMap: Record<string, ConversationTag[]> = {};
      await Promise.all(
        items.map(async (conv) => {
          try {
            const convTags = await api.fetchConversationTagsByIds(conv.id);
            tagsMap[conv.id] = convTags;
          } catch {
            // 静默忽略
          }
        }),
      );
      setConversationTagsMap(tagsMap);
    };
    loadConversationTags();
  }, [items]);

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

  // showNotification 从全局 NotificationContext 获取（在上方解构）

  /** Toggle select mode */
  const toggleSelectMode = () => {
    setIsSelectMode(prev => !prev);
    setSelectedIds(new Set());
  };

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
      showNotification('', t('conversation.renameSuccess'), 'success');
    } catch (err) {
      console.error('Rename failed:', err);
      showNotification('', t('conversation.renameFailed'), 'error');
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
          showNotification('', t('conversation.deleteSuccess'), 'success');
        } catch (err) {
          console.error('Delete conversation failed:', err);
          showNotification('', t('conversation.deleteFailed'), 'error');
        }
      },
    });
  };

  /** Toggle selection */
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  /** Select/deselect all */
  const handleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(item => item.id)));
    }
  };

  /** Batch delete selected conversations */
  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    setConfirmDialog({
      isOpen: true,
      title: t('conversation.batchDelete'),
      message: t('conversation.batchDeleteConfirm', { count }),
      onConfirm: async () => {
        try {
          await api.deleteConversations(Array.from(selectedIds));
          pageRef.current = 0;
          setSelectedIds(new Set());
          setIsSelectMode(false);
          await loadConversations(true, 0);
          showNotification('', t('conversation.batchDeleteSuccess', { count }), 'success');
        } catch (err) {
          console.error('Batch delete failed:', err);
          showNotification('', t('conversation.batchDeleteFailed'), 'error');
        }
      },
    });
  };

  /** Clear all conversations */
  const handleClearAll = () => {
    setConfirmDialog({
      isOpen: true,
      title: t('conversation.clearAll'),
      message: t('conversation.clearAllConfirm'),
      onConfirm: async () => {
        try {
          await api.clearAllConversations();
          pageRef.current = 0;
          await loadConversations(true, 0);
          showNotification('', t('conversation.clearAllSuccess'), 'success');
        } catch (err) {
          console.error('Clear all conversations failed:', err);
          showNotification('', t('conversation.clearAllFailed'), 'error');
        }
      },
    });
  };

  /** Keep only first N conversations */
  const handleKeepFirstN = () => {
    const count = parseInt(keepCount, 10);
    if (isNaN(count) || count < 0) {
      showNotification('', t('conversation.keepCountInvalid'), 'error');
      return;
    }
    if (count >= totalCount) {
      showNotification('', t('conversation.keepCountNoChange'), 'info');
      return;
    }

    const deleteCount = totalCount - count;
    setConfirmDialog({
      isOpen: true,
      title: t('conversation.keepFirstN'),
      message: t('conversation.keepFirstNConfirm', { keep: count, delete: deleteCount }),
      onConfirm: async () => {
        try {
          const result = await api.fetchConversations({
            sort: sortBy,
            order: sortOrder,
            limit: totalCount,
            offset: 0,
          });
          const idsToDelete = result.conversations.slice(count).map(c => c.id);

          if (idsToDelete.length > 0) {
            await api.deleteConversations(idsToDelete);
          }

          pageRef.current = 0;
          setKeepCount('');
          await loadConversations(true, 0);
          showNotification('', t('conversation.keepFirstNSuccess', { count: deleteCount }), 'success');
        } catch (err) {
          console.error('Keep first N failed:', err);
          showNotification('', t('conversation.keepFirstNFailed'), 'error');
        }
      },
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* 固定头部：Banner + 操作栏 + 搜索 */}
      <div className="flex-shrink-0 space-y-3 mb-4">
        {/* 数量提示 Banner */}
        <CountBanner
          show={showBanner}
          title={t('conversation.bannerTitle')}
          description={t('conversation.bannerDescription', { count: totalCount })}
          onDismiss={handleDismissBanner}
        />

        {/* 操作栏 */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowBatchPanel(!showBatchPanel)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl transition-all duration-200 ${
              showBatchPanel
                ? 'text-[var(--btn-primary-text)] bg-[var(--btn-primary)]'
                : 'text-[var(--muted)] bg-[var(--surface-warm-hover)] hover:bg-[var(--border)]'
            }`}
          >
            {showBatchPanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <span>{t('conversation.batchOperations')}</span>
          </button>
          <button
            onClick={handleClearAll}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-red-500 bg-red-500/10 hover:bg-red-500/15 rounded-xl transition-all duration-200"
          >
            <Trash2 size={14} />
            <span>{t('conversation.clearAll')}</span>
          </button>
          {totalCount > 0 && (
            <p className="flex items-center text-xs text-[var(--muted)] ml-auto">
              {t('conversation.countTotal', { count: totalCount })}
            </p>
          )}
        </div>

        {/* 批量操作面板 - 可折叠 */}
        {showBatchPanel && totalCount > 0 && (
          <div className="p-4 bg-[var(--surface-warm-hover)] rounded-xl space-y-4">
            {/* 多选删除 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleSelectMode}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
                    isSelectMode
                      ? 'bg-[var(--accent-indigo)] text-white'
                      : 'text-[var(--muted)] bg-[var(--surface-warm)] hover:bg-[var(--border)]'
                  }`}
                >
                  <ListChecks size={14} />
                  <span>{isSelectMode ? t('conversation.exitSelect') : t('conversation.multiSelect')}</span>
                </button>
                {isSelectMode && (
                  <button
                    onClick={handleSelectAll}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[var(--muted)] bg-[var(--surface-warm)] hover:bg-[var(--border)] rounded-xl transition-colors"
                  >
                    {selectedIds.size === items.length ? (
                      <>
                        <Check size={14} className="text-[var(--accent-indigo)]" />
                        <span>{t('conversation.deselectAll')}</span>
                      </>
                    ) : (
                      <>
                        <X size={14} />
                        <span>{t('conversation.selectAll')}</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                {isSelectMode && (
                  <>
                    <span className="text-sm text-[var(--muted)]">
                      {selectedIds.size > 0
                        ? t('conversation.selectedCount', { count: selectedIds.size })
                        : t('conversation.selectHint')
                      }
                    </span>
                    <button
                      onClick={handleBatchDelete}
                      disabled={selectedIds.size === 0}
                      className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
                        selectedIds.size > 0
                          ? 'bg-red-500 text-white hover:bg-red-600'
                          : 'bg-[var(--surface-warm)] text-[var(--muted)]/50 cursor-not-allowed'
                      }`}
                    >
                      <Trash2 size={14} />
                      <span>{t('conversation.batchDelete')}{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* 分隔线 */}
            <div className="h-px bg-[var(--border)]" />

            {/* 保留前 N 条 */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-[var(--muted)] whitespace-nowrap">{t('conversation.keepFirst')}</span>
              <input
                type="number"
                min="0"
                max={totalCount}
                value={keepCount}
                onChange={(e) => setKeepCount(e.target.value)}
                placeholder={String(Math.min(10, totalCount))}
                className="w-20 px-3 py-2 text-sm text-center bg-[var(--surface-warm)] border border-[var(--border)] rounded-xl text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-indigo)]/30"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleKeepFirstN();
                }}
              />
              <span className="text-sm text-[var(--muted)] whitespace-nowrap">{t('conversation.keepLast')}</span>
              <button
                onClick={handleKeepFirstN}
                disabled={!keepCount || parseInt(keepCount, 10) >= totalCount}
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
                  keepCount && parseInt(keepCount, 10) < totalCount
                    ? 'text-[var(--accent-indigo)] bg-[var(--accent-indigo)]/10 hover:bg-[var(--accent-indigo)]/15'
                    : 'text-[var(--muted)]/50 bg-[var(--surface-warm)] cursor-not-allowed'
                }`}
              >
                {t('conversation.apply')}
              </button>
            </div>
          </div>
        )}

        {/* 搜索和排序 */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]/50" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('conversation.search')}
              className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--surface-warm-hover)] border border-[var(--surface-warm-hover)] rounded-xl text-[var(--fg)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent-indigo)]/30 hover:border-[var(--accent-indigo)]/20 transition-all duration-200"
            />
          </div>
          <TagFilter
            tags={tags}
            selectedTagId={selectedTagId}
            onChange={setSelectedTagId}
          />
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
              <div
                key={item.id}
                onClick={isSelectMode ? () => handleToggleSelect(item.id) : undefined}
                className={`group p-4 rounded-2xl border transition-all duration-200 ${
                  isSelectMode ? 'cursor-pointer' : ''
                } ${
                  selectedIds.has(item.id)
                    ? 'bg-[var(--accent-indigo)]/5 border-[var(--accent-indigo)]/30'
                    : 'bg-[var(--surface-warm-hover)] border-transparent hover:border-[var(--border)]'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* 选择框 - 仅选择模式显示 */}
                  {isSelectMode && (
                    <div className={`w-5 h-5 mt-0.5 flex items-center justify-center rounded border-2 transition-all duration-200 ${
                      selectedIds.has(item.id)
                        ? 'bg-[var(--accent-indigo)] border-[var(--accent-indigo)] text-white'
                        : 'border-[var(--border)] hover:border-[var(--accent-indigo)]/50'
                    }`}>
                      {selectedIds.has(item.id) && <Check size={12} strokeWidth={3} />}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="px-2 py-0.5 text-[11px] font-medium bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)] rounded-lg flex-shrink-0">
                        {item.format}
                      </span>
                      <span className="text-[11px] text-[var(--muted)] flex-shrink-0">
                        {new Date(item.updatedAt).toLocaleString()}
                      </span>
                      {(conversationTagsMap[item.id] || []).length > 0 && (
                        <span className="flex items-center gap-0.5 flex-shrink-0">
                          {(conversationTagsMap[item.id] || []).slice(0, 5).map(tag => (
                            <TagBadge key={tag.id} name={tag.name} color={tag.color} variant="dot" />
                          ))}
                        </span>
                      )}
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
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 px-2 py-1 text-sm bg-[var(--surface-warm)] border border-[var(--accent-indigo)]/30 rounded-lg text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-indigo)]/30"
                        />
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSaveRename(); }}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--accent-indigo)] hover:bg-[var(--accent-indigo)]/10 transition-colors flex-shrink-0"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCancelRename(); }}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-warm-hover)] transition-colors flex-shrink-0"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-[var(--fg)] mb-1 truncate">{item.title}</p>
                    )}
                    {item.configName && (
                      <p className="text-[11px] text-[var(--muted)] truncate">
                        {t('history.modelPrefix')} {item.configName} - {item.configModel}
                      </p>
                    )}
                  </div>

                  {/* 操作按钮 - 非选择模式显示 */}
                  {editingId !== item.id && !isSelectMode && (
                    <div className="flex items-center gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <Tooltip content={t('conversation.rename')} side="top">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStartRename(item); }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200"
                        >
                          <Edit3 size={14} />
                        </button>
                      </Tooltip>
                      <Tooltip content={t('tags.selectTags')} side="top">
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowTagSelector(showTagSelector === item.id ? null : item.id);
                            }}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 ${
                              (conversationTagsMap[item.id] || []).length > 0
                                ? 'text-[var(--accent-indigo)] hover:bg-[var(--accent-indigo)]/10'
                                : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)]'
                            }`}
                          >
                            <Tag size={14} />
                            {(conversationTagsMap[item.id] || []).length > 0 && (
                              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 flex items-center justify-center text-[8px] font-bold text-white bg-[var(--accent-indigo)] rounded-full">
                                {(conversationTagsMap[item.id] || []).length}
                              </span>
                            )}
                          </button>
                          {showTagSelector === item.id && (
                            <TagCloudSelector
                              tags={tags}
                              selectedTagIds={(conversationTagsMap[item.id] || []).map(t => t.id)}
                              onChange={async (tagIds) => {
                                try {
                                  await api.setConversationTags(item.id, tagIds);
                                  const updatedTags = await api.fetchConversationTagsByIds(item.id);
                                  setConversationTagsMap(prev => ({ ...prev, [item.id]: updatedTags }));
                                } catch (err) {
                                  console.error('Failed to update conversation tags:', err);
                                }
                              }}
                              onClose={() => setShowTagSelector(null)}
                            />
                          )}
                        </div>
                      </Tooltip>
                      <Tooltip content={t('common.delete')} side="top">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-500/10 transition-all duration-200"
                        >
                          <Trash2 size={14} />
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
    </div>
  );
}

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import * as api from '@/lib/api-client';
import ConfirmDialog from '@/components/dialogs/ConfirmDialog';
import Notification from '@/components/Notification';
import ScrollToTop from '@/components/ScrollToTop';
import Dropdown from '@/components/ui/Dropdown';
import { useLocale } from '@/locales';
import { Database, Download, Upload, Trash2, Search, HardDrive } from 'lucide-react';
import type { Conversation, ConfirmDialogState, NotificationState } from '@/types';

const PAGE_SIZE = 20;

/** 数据管理组件 — 存储统计、导入导出、清除历史、会话列表 */
export default function DataSettings() {
  const { t } = useLocale();

  // ── Storage statistics ──
  const [conversationCount, setConversationCount] = useState(0);
  const [configCount, setConfigCount] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

  // ── Conversation history list ──
  const [items, setItems] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'updated_at' | 'created_at'>('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const pageRef = useRef(0);

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

  // ── Import/Export state ──
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Load storage statistics */
  const loadStats = useCallback(async () => {
    try {
      const [convResult, configResult] = await Promise.all([
        api.fetchConversationCount(),
        api.fetchConfigs(),
      ]);
      setConversationCount(convResult.count);
      setConfigCount(configResult.configs.length);
    } catch (err) {
      console.error('Failed to load storage stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

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

  // Load stats on mount
  useEffect(() => {
    loadStats();
  }, [loadStats]);

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
          await loadStats();
        } catch (err) {
          console.error('Delete conversation failed:', err);
          showNotification('error', t('settings.clearFailed'));
        }
      },
    });
  };

  /** Export all data as JSON */
  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Export configs
      const configsJson = await api.exportConfigs();

      // Export all conversations (fetch all, not just one page)
      const allConversations = await api.fetchConversations({ limit: 10000, offset: 0 });

      const exportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        configs: configsJson,
        conversations: allConversations.conversations,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-sketch-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showNotification('success', t('settings.exportSuccess'));
    } catch (err) {
      console.error('Export failed:', err);
      showNotification('error', t('settings.exportFailed'));
    } finally {
      setIsExporting(false);
    }
  };

  /** Import LLM configs from JSON file (conversations are not importable) */
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Only configs can be imported — conversations have no bulk import API
      if (data.configs) {
        await api.importConfigs(data.configs);
      }

      // Refresh data
      await loadConversations(true, 0);
      await loadStats();
      showNotification('success', t('settings.importSuccess'));
    } catch (err) {
      console.error('Import failed:', err);
      showNotification('error', t('settings.importFailed'));
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  /** Clear all conversation history */
  const handleClearHistory = () => {
    setConfirmDialog({
      isOpen: true,
      title: t('settings.clearHistory'),
      message: t('settings.clearHistoryConfirm'),
      onConfirm: async () => {
        setIsClearing(true);
        try {
          await api.clearAllConversations();
          pageRef.current = 0;
          await loadConversations(true, 0);
          await loadStats();
          showNotification('success', t('settings.clearSuccess'));
        } catch (err) {
          console.error('Clear history failed:', err);
          showNotification('error', t('settings.clearFailed'));
        } finally {
          setIsClearing(false);
        }
      },
    });
  };

  return (
    <div className="space-y-8">
      {/* Storage Statistics */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <HardDrive size={18} className="text-[var(--accent-indigo)]" />
          <h3 className="text-lg font-semibold text-[var(--fg)]">{t('settings.storageStats')}</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-[var(--surface-warm-hover)] border border-[var(--border)]">
            <p className="text-sm text-[var(--muted)] mb-1">{t('settings.conversations')}</p>
            <p className="text-2xl font-semibold text-[var(--fg)]">
              {statsLoading ? '...' : conversationCount}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[var(--surface-warm-hover)] border border-[var(--border)]">
            <p className="text-sm text-[var(--muted)] mb-1">{t('settings.configs')}</p>
            <p className="text-2xl font-semibold text-[var(--fg)]">
              {statsLoading ? '...' : configCount}
            </p>
          </div>
        </div>
      </section>

      {/* Import / Export */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Database size={18} className="text-[var(--accent-indigo)]" />
          <h3 className="text-lg font-semibold text-[var(--fg)]">{t('settings.data')}</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Export */}
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-3 p-4 rounded-xl bg-[var(--surface-warm-hover)] border border-[var(--border)] hover:border-[var(--accent-indigo)]/30 transition-all duration-200 disabled:opacity-50"
          >
            <Download size={18} className="text-[var(--accent-indigo)]" />
            <div className="text-left">
              <p className="text-sm font-medium text-[var(--fg)]">{t('settings.exportAll')}</p>
              <p className="text-xs text-[var(--muted)]">{t('settings.exportAllDesc')}</p>
            </div>
          </button>

          {/* Import */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="flex items-center gap-3 p-4 rounded-xl bg-[var(--surface-warm-hover)] border border-[var(--border)] hover:border-[var(--accent-indigo)]/30 transition-all duration-200 disabled:opacity-50"
          >
            <Upload size={18} className="text-[var(--accent-indigo)]" />
            <div className="text-left">
              <p className="text-sm font-medium text-[var(--fg)]">{t('settings.importData')}</p>
              <p className="text-xs text-[var(--muted)]">{t('settings.importDataDesc')}</p>
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />

          {/* Clear History */}
          <button
            onClick={handleClearHistory}
            disabled={isClearing || conversationCount === 0}
            className="flex items-center gap-3 p-4 rounded-xl bg-red-500/5 border border-red-500/20 hover:bg-red-500/10 transition-all duration-200 disabled:opacity-50"
          >
            <Trash2 size={18} className="text-red-500" />
            <div className="text-left">
              <p className="text-sm font-medium text-red-600">{t('settings.clearHistory')}</p>
              <p className="text-xs text-red-500/70">{t('settings.clearHistoryDesc')}</p>
            </div>
          </button>
        </div>
      </section>

      {/* Conversation History List */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Database size={18} className="text-[var(--accent-indigo)]" />
          <h3 className="text-lg font-semibold text-[var(--fg)]">{t('history.title')}</h3>
          {totalCount > 0 && (
            <span className="text-xs text-[var(--muted)] bg-black/[0.04] px-2 py-0.5 rounded-full">{totalCount}</span>
          )}
        </div>

        {/* Search and Sort Controls */}
        <div className="mb-3 space-y-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]/50" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('conversation.search')}
              className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--surface-warm-hover)] border border-[var(--surface-warm-hover)] rounded-xl text-[var(--fg)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent-indigo)]/30 transition-all duration-200"
            />
          </div>

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
        <ScrollToTop className="max-h-96 scrollbar-thin" onScroll={handleScroll}>
          <div className="space-y-2">
            {items.length === 0 ? (
              <div className="text-center py-12 text-sm text-[var(--muted)]">
                {searchQuery ? t('conversation.noResults') : t('history.empty')}
              </div>
            ) : (
              items.map((item) => (
                <div key={item.id} className="group p-4 rounded-2xl bg-black/[0.03] hover:bg-black/[0.05] border border-transparent hover:border-black/[0.06] transition-all duration-200">
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
                      {item.configName && (
                        <p className="text-[11px] text-[var(--muted)]">
                          {t('history.modelPrefix')} {item.configName} - {item.configModel}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={13} />
                        <span>{t('common.delete')}</span>
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
      </section>

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

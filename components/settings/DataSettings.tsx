'use client';

import { useState, useEffect, useCallback } from 'react';
import * as api from '@/lib/api/client';
import { useLocale } from '@/lib/locales';
import { useSettings } from '@/hooks/useSettings';
import ConfirmDialog from '@/components/dialogs/ConfirmDialog';
import Notification from '@/components/ui/Notification';
import { HardDrive, RotateCcw, Trash2, Database, Settings, AlertTriangle } from 'lucide-react';
import type { ConfirmDialogState, NotificationState } from '@/lib/types';

/** 数据管理组件 — 存储统计、数据清理与重置 */
export default function DataSettings() {
  const { t } = useLocale();
  const { updateSetting } = useSettings();

  // ── Storage statistics ──
  const [conversationCount, setConversationCount] = useState(0);
  const [configCount, setConfigCount] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

  // ── Operation states ──
  const [isResettingPreferences, setIsResettingPreferences] = useState(false);
  const [isClearingConversations, setIsClearingConversations] = useState(false);
  const [isClearingConfigs, setIsClearingConfigs] = useState(false);
  const [isResettingAll, setIsResettingAll] = useState(false);

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

  // Load stats on mount
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  /** Show a notification toast */
  const showNotification = useCallback((type: NotificationState['type'], message: string) => {
    setNotification({ isOpen: true, title: '', message, type });
  }, []);

  /** Reset user preferences (theme and language) */
  const handleResetPreferences = () => {
    setConfirmDialog({
      isOpen: true,
      title: t('settings.resetPreferences'),
      message: t('settings.resetPreferencesConfirm'),
      onConfirm: async () => {
        setIsResettingPreferences(true);
        try {
          // Reset theme to light
          updateSetting('theme', 'light');
          // Reset locale to zh
          updateSetting('locale', 'zh');
          showNotification('success', t('settings.resetPreferencesSuccess'));
        } catch (err) {
          console.error('Reset preferences failed:', err);
          showNotification('error', t('settings.operationFailed'));
        } finally {
          setIsResettingPreferences(false);
        }
      },
    });
  };

  /** Clear all conversations */
  const handleClearConversations = () => {
    setConfirmDialog({
      isOpen: true,
      title: t('settings.clearConversations'),
      message: t('settings.clearConversationsConfirm'),
      onConfirm: async () => {
        setIsClearingConversations(true);
        try {
          await api.clearAllConversations();
          setConversationCount(0);
          showNotification('success', t('settings.clearConversationsSuccess'));
        } catch (err) {
          console.error('Clear conversations failed:', err);
          showNotification('error', t('settings.operationFailed'));
        } finally {
          setIsClearingConversations(false);
        }
      },
    });
  };

  /** Clear all LLM configs */
  const handleClearConfigs = () => {
    setConfirmDialog({
      isOpen: true,
      title: t('settings.clearConfigs'),
      message: t('settings.clearConfigsConfirm'),
      onConfirm: async () => {
        setIsClearingConfigs(true);
        try {
          // Fetch all configs and delete them one by one
          const { configs } = await api.fetchConfigs();
          for (const config of configs) {
            if (config.id) {
              await api.deleteConfig(config.id);
            }
          }
          setConfigCount(0);
          showNotification('success', t('settings.clearConfigsSuccess'));
        } catch (err) {
          console.error('Clear configs failed:', err);
          showNotification('error', t('settings.operationFailed'));
        } finally {
          setIsClearingConfigs(false);
        }
      },
    });
  };

  /** Reset all data and settings */
  const handleResetAll = () => {
    setConfirmDialog({
      isOpen: true,
      title: t('settings.resetAll'),
      message: t('settings.resetAllConfirm'),
      onConfirm: async () => {
        setIsResettingAll(true);
        try {
          // Reset preferences
          updateSetting('theme', 'light');
          updateSetting('locale', 'zh');

          // Clear conversations
          await api.clearAllConversations();

          // Clear configs
          const { configs } = await api.fetchConfigs();
          for (const config of configs) {
            if (config.id) {
              await api.deleteConfig(config.id);
            }
          }

          // Update local counts
          setConversationCount(0);
          setConfigCount(0);

          showNotification('success', t('settings.resetAllSuccess'));
        } catch (err) {
          console.error('Reset all failed:', err);
          showNotification('error', t('settings.operationFailed'));
        } finally {
          setIsResettingAll(false);
        }
      },
    });
  };

  /** Check if any operation is in progress */
  const isAnyOperationInProgress = isResettingPreferences || isClearingConversations || isClearingConfigs || isResettingAll;

  return (
    <div className="space-y-6">
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

      {/* Data Cleanup */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Database size={18} className="text-[var(--accent-indigo)]" />
          <h3 className="text-lg font-semibold text-[var(--fg)]">{t('settings.dataCleanup')}</h3>
        </div>
        <p className="text-sm text-[var(--muted)] mb-4">{t('settings.dataCleanupDesc')}</p>

        <div className="space-y-3">
          {/* Reset Preferences */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--surface-warm-hover)] border border-[var(--border)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent-indigo)]/10 flex items-center justify-center">
                <Settings size={18} className="text-[var(--accent-indigo)]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--fg)]">{t('settings.resetPreferences')}</p>
                <p className="text-xs text-[var(--muted)]">{t('settings.resetPreferencesDesc')}</p>
              </div>
            </div>
            <button
              onClick={handleResetPreferences}
              disabled={isAnyOperationInProgress}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[var(--accent-indigo)] bg-[var(--accent-indigo)]/10 hover:bg-[var(--accent-indigo)]/15 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCcw size={14} className={isResettingPreferences ? 'animate-spin' : ''} />
              <span>{isResettingPreferences ? t('common.loading') : t('settings.resetPreferences')}</span>
            </button>
          </div>

          {/* Clear Conversations */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--surface-warm-hover)] border border-[var(--border)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--fg)]">{t('settings.clearConversations')}</p>
                <p className="text-xs text-[var(--muted)]">{t('settings.clearConversationsDesc')}</p>
              </div>
            </div>
            <button
              onClick={handleClearConversations}
              disabled={isAnyOperationInProgress || conversationCount === 0}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-500 bg-red-500/10 hover:bg-red-500/15 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 size={14} className={isClearingConversations ? 'animate-pulse' : ''} />
              <span>{isClearingConversations ? t('common.loading') : t('settings.clearConversations')}</span>
            </button>
          </div>

          {/* Clear Configs */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--surface-warm-hover)] border border-[var(--border)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--fg)]">{t('settings.clearConfigs')}</p>
                <p className="text-xs text-[var(--muted)]">{t('settings.clearConfigsDesc')}</p>
              </div>
            </div>
            <button
              onClick={handleClearConfigs}
              disabled={isAnyOperationInProgress || configCount === 0}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-500 bg-red-500/10 hover:bg-red-500/15 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 size={14} className={isClearingConfigs ? 'animate-pulse' : ''} />
              <span>{isClearingConfigs ? t('common.loading') : t('settings.clearConfigs')}</span>
            </button>
          </div>

          {/* Reset All */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-red-500/5 border border-red-500/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <AlertTriangle size={18} className="text-red-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-red-500">{t('settings.resetAll')}</p>
                <p className="text-xs text-[var(--muted)]">{t('settings.resetAllDesc')}</p>
              </div>
            </div>
            <button
              onClick={handleResetAll}
              disabled={isAnyOperationInProgress}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCcw size={14} className={isResettingAll ? 'animate-spin' : ''} />
              <span>{isResettingAll ? t('common.loading') : t('settings.resetAll')}</span>
            </button>
          </div>
        </div>
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

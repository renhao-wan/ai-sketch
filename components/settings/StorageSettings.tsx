'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from '@/lib/api/client';
import { useLocale } from '@/lib/locales';
import { useSettings } from '@/hooks/useSettings';
import ConfirmDialog from '@/components/dialogs/ConfirmDialog';
import { useNotification } from '@/lib/contexts/NotificationContext';
import { HardDrive, RotateCcw, Trash2, Database, Settings, AlertTriangle, Zap, Clock, BarChart3, ChevronDown, Check, Info } from 'lucide-react';
import type { ConfirmDialogState, LLMConfig } from '@/lib/types';

/** 格式化字节数为可读字符串 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/** 格式化百分比 */
function formatPercent(value: number): string {
  return (value * 100).toFixed(1) + '%';
}

interface StorageSettingsProps {
  isVisible?: boolean;
}

/** 存储管理组件 — 统一的存储统计、缓存管理、数据清理与重置 */
export default function StorageSettings({ isVisible = true }: StorageSettingsProps) {
  const { t, setLocale } = useLocale();
  const { updateSetting } = useSettings();
  const { showNotification } = useNotification();

  // ── Storage statistics (from DataSettings) ──
  const [conversationCount, setConversationCount] = useState(0);
  const [configCount, setConfigCount] = useState(0);

  // ── Cache statistics (from CacheSettings) ──
  const [cacheEntries, setCacheEntries] = useState(0);
  const [totalSizeBytes, setTotalSizeBytes] = useState(0);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [hitRate, setHitRate] = useState(0);
  const [ttlDays, setTtlDays] = useState(7);
  const [statsLoading, setStatsLoading] = useState(true);

  // ── TTL settings ──
  const [ttlInput, setTtlInput] = useState(7);
  const [isSavingTtl, setIsSavingTtl] = useState(false);

  // ── Operation states ──
  const [isResettingPreferences, setIsResettingPreferences] = useState(false);
  const [isClearingConversations, setIsClearingConversations] = useState(false);
  const [isClearingConfigs, setIsClearingConfigs] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [isResettingAll, setIsResettingAll] = useState(false);
  const [isClearingAllCache, setIsClearingAllCache] = useState(false);
  const [isClearingExpired, setIsClearingExpired] = useState(false);
  const [isClearingByConfig, setIsClearingByConfig] = useState(false);

  // ── Config list for clear-by-config ──
  const [configs, setConfigs] = useState<LLMConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState('');
  const [isConfigDropdownOpen, setIsConfigDropdownOpen] = useState(false);
  const configDropdownRef = useRef<HTMLDivElement>(null);
  const [isCacheInfoOpen, setIsCacheInfoOpen] = useState(false);
  const cacheInfoRef = useRef<HTMLDivElement>(null);

  // 切换到此 tab 时重置选中状态
  useEffect(() => {
    if (isVisible) {
      setSelectedConfigId('');
      setIsConfigDropdownOpen(false);
    }
  }, [isVisible]);

  // 点击外部关闭下拉列表
  useEffect(() => {
    if (!isConfigDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (configDropdownRef.current && !configDropdownRef.current.contains(e.target as Node)) {
        setIsConfigDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isConfigDropdownOpen]);

  // 点击外部关闭缓存说明
  useEffect(() => {
    if (!isCacheInfoOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (cacheInfoRef.current && !cacheInfoRef.current.contains(e.target as Node)) {
        setIsCacheInfoOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isCacheInfoOpen]);

  // ── Confirm dialog ──
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
  });

  /** 加载所有统计数据 */
  const loadStats = useCallback(async () => {
    try {
      const [convResult, configResult, statsResult, ttlResult] = await Promise.all([
        api.fetchConversationCount(),
        api.fetchConfigs(),
        api.fetchCacheStats(),
        api.fetchCacheTtl(),
      ]);
      setConversationCount(convResult.count);
      setConfigCount(configResult.configs.length);
      setConfigs(configResult.configs);
      setCacheEntries(statsResult.entries);
      setTotalSizeBytes(statsResult.totalSizeBytes);
      setHits(statsResult.hits);
      setMisses(statsResult.misses);
      setHitRate(statsResult.hitRate);
      setTtlDays(statsResult.ttlDays);
      setTtlInput(ttlResult.ttlDays);
    } catch (err) {
      console.error('Failed to load storage stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // ── Data operations (from DataSettings) ──

  const handleResetPreferences = () => {
    setConfirmDialog({
      isOpen: true,
      title: t('settings.resetPreferencesTitle'),
      message: t('settings.resetPreferencesConfirm'),
      onConfirm: async () => {
        setIsResettingPreferences(true);
        try {
          updateSetting('theme', 'light');
          setLocale('zh');
          showNotification('', t('settings.resetPreferencesSuccess'), 'success');
        } catch (err) {
          console.error('Reset preferences failed:', err);
          showNotification('', t('settings.operationFailed'), 'error');
        } finally {
          setIsResettingPreferences(false);
        }
      },
    });
  };

  const handleClearConversations = () => {
    setConfirmDialog({
      isOpen: true,
      title: t('settings.clearConversationsTitle'),
      message: t('settings.clearConversationsConfirm'),
      onConfirm: async () => {
        setIsClearingConversations(true);
        try {
          await api.clearAllConversations();
          setConversationCount(0);
          showNotification('', t('settings.clearConversationsSuccess'), 'success');
        } catch (err) {
          console.error('Clear conversations failed:', err);
          showNotification('', t('settings.operationFailed'), 'error');
        } finally {
          setIsClearingConversations(false);
        }
      },
    });
  };

  const handleClearConfigs = () => {
    setConfirmDialog({
      isOpen: true,
      title: t('settings.clearConfigsTitle'),
      message: t('settings.clearConfigsConfirm'),
      onConfirm: async () => {
        setIsClearingConfigs(true);
        try {
          const { configs } = await api.fetchConfigs();
          for (const config of configs) {
            if (config.id) {
              await api.deleteConfig(config.id);
            }
          }
          setConfigCount(0);
          showNotification('', t('settings.clearConfigsSuccess'), 'success');
        } catch (err) {
          console.error('Clear configs failed:', err);
          showNotification('', t('settings.operationFailed'), 'error');
        } finally {
          setIsClearingConfigs(false);
        }
      },
    });
  };

  const handleClearCacheFromData = () => {
    setConfirmDialog({
      isOpen: true,
      title: t('settings.clearCacheTitle'),
      message: t('settings.clearCacheConfirm'),
      onConfirm: async () => {
        setIsClearingCache(true);
        try {
          await api.clearCache();
          await loadStats();
          showNotification('', t('settings.clearCacheSuccess'), 'success');
        } catch (err) {
          console.error('Clear cache failed:', err);
          showNotification('', t('settings.operationFailed'), 'error');
        } finally {
          setIsClearingCache(false);
        }
      },
    });
  };

  const handleResetAll = () => {
    setConfirmDialog({
      isOpen: true,
      title: t('settings.resetAll'),
      message: t('settings.resetAllConfirm'),
      onConfirm: async () => {
        setIsResettingAll(true);
        try {
          updateSetting('theme', 'light');
          setLocale('zh');
          await api.clearAllConversations();
          const { configs } = await api.fetchConfigs();
          for (const config of configs) {
            if (config.id) {
              await api.deleteConfig(config.id);
            }
          }
          await api.clearCache();
          await api.resetMeta();
          await fetch('/api/configs/actions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reset-window-state' }),
          });
          setConversationCount(0);
          setConfigCount(0);
          setCacheEntries(0);
          showNotification('', t('settings.resetAllSuccess'), 'success');
        } catch (err) {
          console.error('Reset all failed:', err);
          showNotification('', t('settings.operationFailed'), 'error');
        } finally {
          setIsResettingAll(false);
        }
      },
    });
  };

  // ── Cache operations (from CacheSettings) ──

  const handleClearAllCache = () => {
    setConfirmDialog({
      isOpen: true,
      title: t('cache.clearAll'),
      message: t('cache.clearAllConfirm'),
      onConfirm: async () => {
        setIsClearingAllCache(true);
        try {
          await api.clearCache();
          await loadStats();
          showNotification('', t('cache.clearSuccess'), 'success');
        } catch (err) {
          console.error('Clear all cache failed:', err);
          showNotification('', t('settings.operationFailed'), 'error');
        } finally {
          setIsClearingAllCache(false);
        }
      },
    });
  };

  const handleClearExpired = async () => {
    setIsClearingExpired(true);
    try {
      await api.clearExpiredCache();
      await loadStats();
      showNotification('', t('cache.clearSuccess'), 'success');
    } catch (err) {
      console.error('Clear expired cache failed:', err);
      showNotification('', t('settings.operationFailed'), 'error');
    } finally {
      setIsClearingExpired(false);
    }
  };

  const handleClearByConfig = async () => {
    if (!selectedConfigId) return;
    const config = configs.find(c => c.id === selectedConfigId);
    if (!config) return;

    setIsClearingByConfig(true);
    try {
      await api.clearCacheByConfig(config.name, config.model);
      await loadStats();
      showNotification('', t('cache.clearSuccess'), 'success');
    } catch (err) {
      console.error('Clear cache by config failed:', err);
      showNotification('', t('settings.operationFailed'), 'error');
    } finally {
      setIsClearingByConfig(false);
    }
  };

  const handleSaveTtl = async () => {
    setIsSavingTtl(true);
    try {
      const result = await api.setCacheTtl(ttlInput);
      setTtlDays(result.ttlDays);
      showNotification('', t('cache.ttlSaved'), 'success');
    } catch (err) {
      console.error('Save TTL failed:', err);
      showNotification('', t('settings.operationFailed'), 'error');
    } finally {
      setIsSavingTtl(false);
    }
  };

  const isAnyOperationInProgress = isResettingPreferences || isClearingConversations || isClearingConfigs || isClearingCache || isResettingAll || isClearingAllCache || isClearingExpired || isClearingByConfig || isSavingTtl;

  return (
    <div className="space-y-8">
      {/* ── Section 1: 存储统计 ── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <HardDrive size={18} className="text-[var(--accent-indigo)]" />
          <h3 className="text-lg font-semibold text-[var(--fg)]">{t('settings.storageStats')}</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
          <div className="p-4 rounded-xl bg-[var(--surface-warm-hover)] border border-[var(--border)]">
            <p className="text-sm text-[var(--muted)] mb-1">{t('cache.entries')}</p>
            <p className="text-2xl font-semibold text-[var(--fg)]">
              {statsLoading ? '...' : cacheEntries}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[var(--surface-warm-hover)] border border-[var(--border)]">
            <p className="text-sm text-[var(--muted)] mb-1">{t('cache.size')}</p>
            <p className="text-2xl font-semibold text-[var(--fg)]">
              {statsLoading ? '...' : formatBytes(totalSizeBytes)}
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 2: 缓存详情与操作 ── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={18} className="text-[var(--accent-indigo)]" />
          <h3 className="text-lg font-semibold text-[var(--fg)]">{t('cache.stats')}</h3>
          <div className="relative" ref={cacheInfoRef}>
            <button
              type="button"
              onClick={() => setIsCacheInfoOpen(!isCacheInfoOpen)}
              className="w-5 h-5 flex items-center justify-center rounded-full text-[var(--muted)] hover:text-[var(--accent-indigo)] hover:bg-[var(--accent-indigo)]/10 transition-colors"
            >
              <Info size={14} />
            </button>
            {isCacheInfoOpen && (
              <div className="absolute top-full left-0 mt-2 z-50 w-72 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-xl text-xs text-[var(--muted)] space-y-1.5 leading-relaxed">
                <p>{t('cache.howItWorks')}</p>
                <p>{t('cache.whenHit')}</p>
                <p>{t('cache.whenNoHit')}</p>
              </div>
            )}
          </div>
        </div>
        {/* 缓存指标 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <div className="p-4 rounded-xl bg-[var(--surface-warm-hover)] border border-[var(--border)]">
            <p className="text-sm text-[var(--muted)] mb-1">{t('cache.hitRate')}</p>
            <p className="text-2xl font-semibold text-[var(--fg)]">
              {statsLoading ? '...' : formatPercent(hitRate)}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[var(--surface-warm-hover)] border border-[var(--border)]">
            <p className="text-sm text-[var(--muted)] mb-1">{t('cache.hits')}</p>
            <p className="text-2xl font-semibold text-[var(--fg)]">
              {statsLoading ? '...' : hits}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[var(--surface-warm-hover)] border border-[var(--border)]">
            <p className="text-sm text-[var(--muted)] mb-1">{t('cache.misses')}</p>
            <p className="text-2xl font-semibold text-[var(--fg)]">
              {statsLoading ? '...' : misses}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[var(--surface-warm-hover)] border border-[var(--border)]">
            <p className="text-sm text-[var(--muted)] mb-1">{t('cache.ttl')}</p>
            <p className="text-2xl font-semibold text-[var(--fg)]">
              {statsLoading ? '...' : `${ttlDays} ${t('cache.days')}`}
            </p>
          </div>
        </div>

        {/* 缓存操作 */}
        <div className="space-y-3">
          {/* 清除全部缓存 */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--surface-warm-hover)] border border-[var(--border)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--fg)]">{t('cache.clearAll')}</p>
                <p className="text-xs text-[var(--muted)]">{t('cache.clearAllDesc')}</p>
              </div>
            </div>
            <button
              onClick={handleClearAllCache}
              disabled={isAnyOperationInProgress || cacheEntries === 0}
              className="flex items-center justify-center gap-1.5 w-24 py-2 text-sm font-medium text-red-500 bg-red-500/10 hover:bg-red-500/15 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 size={14} className={isClearingAllCache ? 'animate-pulse' : ''} />
              <span>{isClearingAllCache ? t('common.loading') : t('cache.clear')}</span>
            </button>
          </div>

          {/* 清除过期缓存 */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--surface-warm-hover)] border border-[var(--border)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Zap size={18} className="text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--fg)]">{t('cache.clearExpired')}</p>
                <p className="text-xs text-[var(--muted)]">{t('cache.clearExpiredDesc')}</p>
              </div>
            </div>
            <button
              onClick={handleClearExpired}
              disabled={isAnyOperationInProgress || cacheEntries === 0}
              className="flex items-center justify-center gap-1.5 w-24 py-2 text-sm font-medium text-amber-500 bg-amber-500/10 hover:bg-amber-500/15 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Zap size={14} className={isClearingExpired ? 'animate-pulse' : ''} />
              <span>{isClearingExpired ? t('common.loading') : t('cache.clear')}</span>
            </button>
          </div>

          {/* 按配置清除 */}
          <div className="p-4 rounded-xl bg-[var(--surface-warm-hover)] border border-[var(--border)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent-indigo)]/10 flex items-center justify-center">
                <Settings size={18} className="text-[var(--accent-indigo)]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--fg)]">{t('cache.clearByConfig')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div ref={configDropdownRef} className="relative flex-1">
                <button
                  type="button"
                  onClick={() => setIsConfigDropdownOpen(!isConfigDropdownOpen)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface-warm)] text-[var(--fg)] hover:border-[var(--accent-indigo)]/30 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent-indigo)]/20 transition-all duration-200"
                >
                  <span className={selectedConfigId ? 'text-[var(--fg)]' : 'text-[var(--muted)]'}>
                    {selectedConfigId
                      ? (() => { const c = configs.find(c => c.id === selectedConfigId); return c ? `${c.name} — ${c.model}` : ''; })()
                      : t('cache.selectConfig')
                    }
                  </span>
                  <ChevronDown size={14} className={`text-[var(--muted)] transition-transform duration-200 ${isConfigDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isConfigDropdownOpen && configs.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-50 py-1 rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-xl overflow-hidden">
                    {configs.map((config) => (
                      <button
                        key={config.id}
                        type="button"
                        onClick={() => {
                          setSelectedConfigId(selectedConfigId === config.id ? '' : (config.id ?? ''));
                          setIsConfigDropdownOpen(false);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm text-[var(--fg)] hover:bg-[var(--accent-indigo)]/10 transition-colors duration-150"
                      >
                        <span className="truncate">{config.name} — {config.model}</span>
                        {selectedConfigId === config.id && (
                          <Check size={14} className="text-[var(--accent-indigo)] flex-shrink-0 ml-2" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={handleClearByConfig}
                disabled={isAnyOperationInProgress || !selectedConfigId}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-amber-500 bg-amber-500/10 hover:bg-amber-500/15 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 size={14} className={isClearingByConfig ? 'animate-pulse' : ''} />
                <span>{isClearingByConfig ? t('common.loading') : t('cache.clear')}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 3: TTL 设置 ── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Clock size={18} className="text-[var(--accent-indigo)]" />
          <h3 className="text-lg font-semibold text-[var(--fg)]">{t('cache.ttlSettings')}</h3>
        </div>
        <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--surface-warm-hover)] border border-[var(--border)]">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-[var(--fg)]" htmlFor="cache-ttl-input">
              {t('cache.ttlLabel')}
            </label>
            <input
              id="cache-ttl-input"
              type="number"
              min={1}
              max={365}
              value={ttlInput}
              onChange={(e) => setTtlInput(Math.max(1, Math.min(365, Number(e.target.value))))}
              className="w-20 px-3 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface-warm)] text-[var(--fg)] text-center focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent-indigo)]/20 focus:border-[var(--accent-indigo)]"
            />
            <span className="text-sm text-[var(--muted)]">{t('cache.days')}</span>
          </div>
          <button
            onClick={handleSaveTtl}
            disabled={isAnyOperationInProgress || ttlInput === ttlDays}
            className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-[var(--accent-indigo)] bg-[var(--accent-indigo)]/10 hover:bg-[var(--accent-indigo)]/15 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>{isSavingTtl ? t('common.loading') : t('common.save')}</span>
          </button>
        </div>
      </section>

      {/* ── Section 4: 数据清理与重置 ── */}
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
                <p className="text-sm font-medium text-[var(--fg)]">{t('settings.resetPreferencesTitle')}</p>
                <p className="text-xs text-[var(--muted)]">{t('settings.resetPreferencesDesc')}</p>
              </div>
            </div>
            <button
              onClick={handleResetPreferences}
              disabled={isAnyOperationInProgress}
              className="flex items-center justify-center gap-1.5 w-24 py-2 text-sm font-medium text-[var(--accent-indigo)] bg-[var(--accent-indigo)]/10 hover:bg-[var(--accent-indigo)]/15 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
                <p className="text-sm font-medium text-[var(--fg)]">{t('settings.clearConversationsTitle')}</p>
                <p className="text-xs text-[var(--muted)]">{t('settings.clearConversationsDesc')}</p>
              </div>
            </div>
            <button
              onClick={handleClearConversations}
              disabled={isAnyOperationInProgress || conversationCount === 0}
              className="flex items-center justify-center gap-1.5 w-24 py-2 text-sm font-medium text-red-500 bg-red-500/10 hover:bg-red-500/15 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
                <p className="text-sm font-medium text-[var(--fg)]">{t('settings.clearConfigsTitle')}</p>
                <p className="text-xs text-[var(--muted)]">{t('settings.clearConfigsDesc')}</p>
              </div>
            </div>
            <button
              onClick={handleClearConfigs}
              disabled={isAnyOperationInProgress || configCount === 0}
              className="flex items-center justify-center gap-1.5 w-24 py-2 text-sm font-medium text-red-500 bg-red-500/10 hover:bg-red-500/15 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 size={14} className={isClearingConfigs ? 'animate-pulse' : ''} />
              <span>{isClearingConfigs ? t('common.loading') : t('settings.clearConfigs')}</span>
            </button>
          </div>

          {/* Clear Cache (from data section) */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--surface-warm-hover)] border border-[var(--border)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Zap size={18} className="text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--fg)]">{t('settings.clearCacheTitle')}</p>
                <p className="text-xs text-[var(--muted)]">{t('settings.clearCacheDesc')}</p>
              </div>
            </div>
            <button
              onClick={handleClearCacheFromData}
              disabled={isAnyOperationInProgress || cacheEntries === 0}
              className="flex items-center justify-center gap-1.5 w-24 py-2 text-sm font-medium text-amber-500 bg-amber-500/10 hover:bg-amber-500/15 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Zap size={14} className={isClearingCache ? 'animate-pulse' : ''} />
              <span>{isClearingCache ? t('common.loading') : t('settings.clearCache')}</span>
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
              className="flex items-center justify-center gap-1.5 w-24 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
    </div>
  );
}

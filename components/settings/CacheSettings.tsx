'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from '@/lib/api/client';
import { useLocale } from '@/lib/locales';
import ConfirmDialog from '@/components/dialogs/ConfirmDialog';
import { useNotification } from '@/lib/contexts/NotificationContext';
import { Database, Trash2, Zap, Clock, BarChart3, Settings, ChevronDown, Check } from 'lucide-react';
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

interface CacheSettingsProps {
  isVisible?: boolean;
}

/** 缓存管理组件 — 缓存统计、清理与 TTL 设置 */
export default function CacheSettings({ isVisible = true }: CacheSettingsProps) {
  const { t } = useLocale();
  const { showNotification } = useNotification();

  // ── Cache statistics ──
  const [entries, setEntries] = useState(0);
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
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [isClearingExpired, setIsClearingExpired] = useState(false);
  const [isClearingByConfig, setIsClearingByConfig] = useState(false);

  // ── Config list for clear-by-config ──
  const [configs, setConfigs] = useState<LLMConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState('');
  const [isConfigDropdownOpen, setIsConfigDropdownOpen] = useState(false);
  const configDropdownRef = useRef<HTMLDivElement>(null);

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

  // ── Confirm dialog ──
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
  });

  /** 加载缓存统计 */
  const loadStats = useCallback(async () => {
    try {
      const [statsResult, ttlResult, configResult] = await Promise.all([
        api.fetchCacheStats(),
        api.fetchCacheTtl(),
        api.fetchConfigs(),
      ]);
      setEntries(statsResult.entries);
      setTotalSizeBytes(statsResult.totalSizeBytes);
      setHits(statsResult.hits);
      setMisses(statsResult.misses);
      setHitRate(statsResult.hitRate);
      setTtlDays(statsResult.ttlDays);
      setTtlInput(ttlResult.ttlDays);
      setConfigs(configResult.configs);
    } catch (err) {
      console.error('Failed to load cache stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // 组件挂载时加载统计
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  /** 清除全部缓存 */
  const handleClearAll = () => {
    setConfirmDialog({
      isOpen: true,
      title: t('cache.clearAll'),
      message: t('cache.clearAllConfirm'),
      onConfirm: async () => {
        setIsClearingAll(true);
        try {
          await api.clearCache();
          await loadStats();
          showNotification('', t('cache.clearSuccess'), 'success');
        } catch (err) {
          console.error('Clear all cache failed:', err);
          showNotification('', t('settings.operationFailed'), 'error');
        } finally {
          setIsClearingAll(false);
        }
      },
    });
  };

  /** 清除过期缓存 */
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

  /** 按配置清除缓存 */
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

  /** 保存 TTL 设置 */
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

  const isAnyOperationInProgress = isClearingAll || isClearingExpired || isClearingByConfig || isSavingTtl;

  return (
    <div className="space-y-6">
      {/* 缓存统计 */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={18} className="text-[var(--accent-indigo)]" />
          <h3 className="text-lg font-semibold text-[var(--fg)]">{t('cache.stats')}</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[var(--surface-warm-hover)] border border-[var(--border)]">
            <p className="text-sm text-[var(--muted)] mb-1">{t('cache.entries')}</p>
            <p className="text-2xl font-semibold text-[var(--fg)]">
              {statsLoading ? '...' : entries}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[var(--surface-warm-hover)] border border-[var(--border)]">
            <p className="text-sm text-[var(--muted)] mb-1">{t('cache.size')}</p>
            <p className="text-2xl font-semibold text-[var(--fg)]">
              {statsLoading ? '...' : formatBytes(totalSizeBytes)}
            </p>
          </div>
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
      </section>

      {/* 缓存操作 */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Database size={18} className="text-[var(--accent-indigo)]" />
          <h3 className="text-lg font-semibold text-[var(--fg)]">{t('cache.operations')}</h3>
        </div>
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
              onClick={handleClearAll}
              disabled={isAnyOperationInProgress || entries === 0}
              className="flex items-center justify-center gap-1.5 w-24 py-2 text-sm font-medium text-red-500 bg-red-500/10 hover:bg-red-500/15 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 size={14} className={isClearingAll ? 'animate-pulse' : ''} />
              <span>{isClearingAll ? t('common.loading') : t('cache.clear')}</span>
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
              disabled={isAnyOperationInProgress || entries === 0}
              className="flex items-center justify-center gap-1.5 w-24 py-2 text-sm font-medium text-amber-500 bg-amber-500/10 hover:bg-amber-500/15 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Zap size={14} className={isClearingExpired ? 'animate-pulse' : ''} />
              <span>{isClearingExpired ? t('common.loading') : t('cache.clear')}</span>
            </button>
          </div>
        </div>
      </section>

      {/* 按配置清除 */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Settings size={18} className="text-[var(--accent-indigo)]" />
          <h3 className="text-lg font-semibold text-[var(--fg)]">{t('cache.clearByConfig')}</h3>
        </div>
        <div className="flex items-center gap-3">
          {/* 自定义下拉选择器 */}
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
                      // 点击已选中的项则取消选中
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
      </section>

      {/* TTL 设置 */}
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

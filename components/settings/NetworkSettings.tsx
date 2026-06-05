'use client';

import { useState, useEffect } from 'react';
import { Globe, Loader2, RefreshCw } from 'lucide-react';
import { useLocale } from '@/lib/locales';
import Notification from '@/components/ui/Notification';
import type { NotificationState } from '@/lib/types';

/** 网络代理与全局 LLM 设置 */
export function NetworkSettings() {
  const { t } = useLocale();
  const [proxyEnabled, setProxyEnabled] = useState(false);
  const [proxyUrl, setProxyUrl] = useState('http://127.0.0.1:7890');
  const [maxRetries, setMaxRetries] = useState(2);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<NotificationState>({ isOpen: false, title: '', message: '', type: 'info' });

  /** 加载代理和重试配置 */
  useEffect(() => {
    (async () => {
      try {
        const [proxyRes, retriesRes] = await Promise.all([
          fetch('/api/configs/actions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get-proxy' }),
          }),
          fetch('/api/configs/actions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get-retries' }),
          }),
        ]);
        if (proxyRes.ok) {
          const data = await proxyRes.json();
          if (data.proxyUrl !== undefined) setProxyUrl(data.proxyUrl);
          if (data.proxyEnabled !== undefined) setProxyEnabled(data.proxyEnabled);
        }
        if (retriesRes.ok) {
          const data = await retriesRes.json();
          if (data.maxRetries !== undefined) setMaxRetries(data.maxRetries);
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /** 切换代理开关时自动保存到数据库 */
  const handleToggle = async () => {
    const next = !proxyEnabled;
    setProxyEnabled(next);
    try {
      const res = await fetch('/api/configs/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-proxy', proxyUrl, proxyEnabled: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error('Failed to toggle proxy:', err);
      // 回滚本地状态
      setProxyEnabled(!next);
    }
  };

  /** 保存代理地址 */
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/configs/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-proxy', proxyUrl, proxyEnabled }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `HTTP ${res.status}`);
      }
      setNotification({ isOpen: true, title: t('proxy.saveSuccess'), message: '', type: 'success' });
    } catch (err) {
      setNotification({ isOpen: true, title: t('proxy.saveFailed'), message: (err as Error).message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  /** 保存重试配置 */
  const handleSaveRetries = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/configs/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-retries', maxRetries }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `HTTP ${res.status}`);
      }
      setNotification({ isOpen: true, title: t('retries.saveSuccess'), message: '', type: 'success' });
    } catch (err) {
      setNotification({ isOpen: true, title: t('retries.saveFailed'), message: (err as Error).message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin text-[var(--muted)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 代理开关 */}
      <section>
        <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--surface-warm)] border border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--accent-indigo)]/10 flex items-center justify-center">
              <Globe size={18} className="text-[var(--accent-indigo)]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--fg)]">{t('proxy.enable')}</p>
              <p className="text-xs text-[var(--muted)]">{t('proxy.enableDesc')}</p>
            </div>
          </div>
          <button
            onClick={handleToggle}
            className={`relative w-11 h-6 rounded-full transition-all duration-200 hover:brightness-110 hover:ring-2 hover:ring-[var(--accent-indigo)]/20 ${
              proxyEnabled ? 'bg-[var(--accent-indigo)]' : 'bg-[var(--muted)]/30'
            }`}
          >
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              proxyEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'
            }`} />
          </button>
        </div>
      </section>

      {/* 代理地址 */}
      <section className={!proxyEnabled ? 'opacity-50 pointer-events-none' : ''}>
        <label className="block text-sm font-medium text-[var(--fg)] mb-2">{t('proxy.url')}</label>
        <input
          type="text"
          value={proxyUrl}
          onChange={(e) => setProxyUrl(e.target.value)}
          placeholder="http://127.0.0.1:7890"
          disabled={!proxyEnabled}
          className="w-full px-4 py-2.5 text-sm bg-[var(--surface-warm)] border border-[var(--border)] rounded-xl text-[var(--fg)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent-indigo)]/30 focus:border-[var(--accent-indigo)]/40 hover:border-[var(--accent-indigo)]/20 transition-all duration-200"
        />
        <p className="mt-2 text-xs text-[var(--muted)]">{t('proxy.urlHint')}</p>
      </section>

      {/* 保存按钮 */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || !proxyEnabled}
          className="px-5 py-2 text-sm text-[var(--btn-primary-text)] bg-[var(--btn-primary)] rounded-xl hover:bg-[var(--btn-primary-hover)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium flex items-center gap-2"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {t('proxy.save')}
        </button>
      </div>

      {/* 分隔线 */}
      <div className="border-t border-[var(--border)]" />

      {/* LLM 失败重试 */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-[var(--accent-indigo)]/10 flex items-center justify-center">
            <RefreshCw size={18} className="text-[var(--accent-indigo)]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--fg)]">{t('retries.title')}</p>
            <p className="text-xs text-[var(--muted)]">{t('retries.description')}</p>
          </div>
        </div>
        <div className="space-y-3">
          <label className="block text-sm font-medium text-[var(--fg)]">{t('retries.maxRetries')}</label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="5"
              step="1"
              value={maxRetries}
              onChange={(e) => setMaxRetries(parseInt(e.target.value, 10))}
              className="flex-1 h-2 bg-[var(--surface-warm-hover)] rounded-lg appearance-none cursor-pointer accent-[var(--accent-indigo)]"
            />
            <span className="text-sm font-mono text-[var(--fg)] w-8 text-right">{maxRetries}</span>
          </div>
          <p className="text-xs text-[var(--muted)]">{t('retries.maxRetriesHint')}</p>
          <div className="flex justify-end">
            <button
              onClick={handleSaveRetries}
              disabled={saving}
              className="px-5 py-2 text-sm text-[var(--btn-primary-text)] bg-[var(--btn-primary)] rounded-xl hover:bg-[var(--btn-primary-hover)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium flex items-center gap-2"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {t('retries.save')}
            </button>
          </div>
        </div>
      </section>

      <Notification
        isOpen={notification.isOpen}
        onClose={() => setNotification({ ...notification, isOpen: false })}
        title={notification.title}
        message={notification.message}
        type={notification.type}
      />
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import * as api from '@/lib/api-client';
import { useLocale } from '@/locales';
import { HardDrive } from 'lucide-react';

/** 数据管理组件 — 存储统计 */
export default function DataSettings() {
  const { t } = useLocale();

  // ── Storage statistics ──
  const [conversationCount, setConversationCount] = useState(0);
  const [configCount, setConfigCount] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

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
    </div>
  );
}

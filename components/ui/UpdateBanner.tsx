'use client';

/**
 * 更新通知横幅
 * 在有可用更新时显示，支持下载和安装
 */

import { useUpdate } from '@/hooks/useUpdate';
import { useLocale } from '@/lib/locales';
import { Download, Check, Loader2, X, RefreshCw } from 'lucide-react';

export default function UpdateBanner() {
  const { t } = useLocale();
  const { isElectron, status, info, progress, error, downloadUpdate, installUpdate } = useUpdate();

  // 非 Electron 环境不显示
  if (!isElectron) return null;

  // 不显示的状态
  if (status === 'idle' || status === 'checking' || status === 'not-available') return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-full mx-4">
      <div className="bg-[var(--surface-warm)] backdrop-blur-2xl rounded-2xl border border-[var(--border)] shadow-[0_8px_30px_rgba(28,25,23,0.12)] p-4">
        {status === 'available' && (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[var(--accent-indigo)]/10 flex items-center justify-center flex-shrink-0">
              <Download size={16} className="text-[var(--accent-indigo)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--fg)]">
                {t('update.available')} v{info?.version}
              </p>
              <p className="text-xs text-[var(--muted)] truncate">{t('update.availableHint')}</p>
            </div>
            <button
              onClick={downloadUpdate}
              className="px-4 py-1.5 text-sm font-medium text-[var(--btn-primary-text)] bg-[var(--btn-primary)] rounded-lg hover:bg-[var(--btn-primary-hover)] active:scale-[0.98] transition-all duration-200"
            >
              {t('update.download')}
            </button>
          </div>
        )}

        {status === 'downloading' && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Loader2 size={16} className="text-[var(--accent-indigo)] animate-spin flex-shrink-0" />
              <p className="text-sm font-medium text-[var(--fg)]">
                {t('update.downloading')} {Math.round(progress)}%
              </p>
            </div>
            <div className="w-full h-1.5 bg-[var(--surface-warm-hover)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--accent-indigo)] rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {status === 'downloaded' && (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
              <Check size={16} className="text-green-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--fg)]">{t('update.downloaded')}</p>
              <p className="text-xs text-[var(--muted)]">{t('update.downloadedHint')}</p>
            </div>
            <button
              onClick={installUpdate}
              className="px-4 py-1.5 text-sm font-medium text-white bg-green-500 rounded-lg hover:bg-green-600 active:scale-[0.98] transition-all duration-200"
            >
              {t('update.install')}
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
              <X size={16} className="text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--fg)]">{t('update.error')}</p>
              <p className="text-xs text-[var(--muted)] truncate">{error}</p>
            </div>
            <button
              onClick={downloadUpdate}
              className="p-1.5 text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] rounded-lg transition-all duration-200"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

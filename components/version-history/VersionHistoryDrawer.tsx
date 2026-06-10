'use client';

import { useEffect, useRef } from 'react';
import { X, Clock } from 'lucide-react';
import { useLocale } from '@/lib/locales';
import VersionCard from './VersionCard';

export interface VersionItem {
  id: string;
  versionNumber: number;
  createdAt: number;
}

interface VersionHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  versions: VersionItem[];
  currentVersionId: string | null;
  onSelectVersion: (versionId: string) => void;
  thumbnails: Map<string, string>;
}

export default function VersionHistoryDrawer({
  open,
  onClose,
  versions,
  currentVersionId,
  onSelectVersion,
  thumbnails,
}: VersionHistoryDrawerProps) {
  const { t } = useLocale();
  const drawerRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, onClose]);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  return (
    <>
      {/* 遮罩层 */}
      <div
        className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* 抽屉面板 */}
      <div
        ref={drawerRef}
        className={`fixed top-0 right-0 h-full w-[360px] bg-[var(--bg)] border-l border-[var(--border)] shadow-2xl z-50
          transform transition-transform duration-200 ease-out
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-[var(--accent-indigo)]" />
            <h2 className="text-sm font-semibold text-[var(--text)]">{t('versionHistory.title')}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--surface-elevated)] text-[var(--muted)] hover:text-[var(--text)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* 版本列表 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ height: 'calc(100% - 56px)' }}>
          {versions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Clock size={48} className="text-[var(--muted)] opacity-30 mb-4" />
              <p className="text-sm font-medium text-[var(--muted)]">{t('versionHistory.empty')}</p>
              <p className="text-xs text-[var(--muted)] mt-1">{t('versionHistory.emptyDesc')}</p>
            </div>
          ) : (
            versions.map((version) => (
              <VersionCard
                key={version.id}
                id={version.id}
                versionNumber={version.versionNumber}
                createdAt={version.createdAt}
                isCurrent={version.id === currentVersionId}
                thumbnail={thumbnails.get(version.id)}
                onSelect={onSelectVersion}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}

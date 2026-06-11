'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Clock } from 'lucide-react';
import { useLocale } from '@/lib/locales';
import { getStrategy } from '@/lib/strategies/registry';
import type { DiagramFormat } from '@/lib/types/diagram-strategy';
import VersionCard from './VersionCard';

export interface VersionItem {
  id: string;
  versionNumber: number;
  createdAt: number;
  code: string;
  format: DiagramFormat;
}

interface VersionHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  versions: VersionItem[];
  currentVersionId: string | null;
  onSelectVersion: (versionId: string) => void;
}

export default function VersionHistoryDrawer({
  open,
  onClose,
  versions,
  currentVersionId,
  onSelectVersion,
}: VersionHistoryDrawerProps) {
  const { t } = useLocale();
  const drawerRef = useRef<HTMLDivElement>(null);
  const [previews, setPreviews] = useState<Map<string, string>>(new Map());
  const [loadingSet, setLoadingSet] = useState<Set<string>>(new Set());
  const loadedRef = useRef(false);

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

  // 抽屉打开时加载所有版本预览
  useEffect(() => {
    if (!open) {
      loadedRef.current = false;
      return;
    }
    if (loadedRef.current) return;
    loadedRef.current = true;

    // 找出需要加载的版本
    const toLoad = versions.filter(v => !previews.has(v.id));
    if (toLoad.length === 0) return;

    // 标记全部为 loading
    setLoadingSet(new Set(toLoad.map(v => v.id)));

    // 串行加载，每个版本用自己的 format
    (async () => {
      for (const version of toLoad) {
        try {
          const strategy = getStrategy(version.format);
          const svg = await strategy.generatePreview?.(version.code);
          if (svg) {
            setPreviews(prev => new Map(prev).set(version.id, svg));
          }
        } catch {
          // 忽略
        }
        setLoadingSet(prev => {
          const next = new Set(prev);
          next.delete(version.id);
          return next;
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, versions]);

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
        className={`fixed top-0 right-0 h-full w-[360px] bg-[var(--bg)] border-l border-[var(--border)] shadow-2xl z-50 overflow-y-auto
          transform transition-transform duration-200 ease-out
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* 头部 */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 h-14 border-b border-[var(--border)] bg-[var(--bg)]">
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
        <div className="p-4 space-y-3">
          {versions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
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
                svg={previews.get(version.id)}
                loading={loadingSet.has(version.id)}
                onSelect={onSelectVersion}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}

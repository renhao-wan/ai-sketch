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
  const loadingSetRef = useRef<Set<string>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

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

  // 懒加载单个版本预览
  const loadPreview = useCallback(async (version: VersionItem) => {
    if (previews.has(version.id) || loadingSetRef.current.has(version.id)) return;

    loadingSetRef.current.add(version.id);
    setLoadingSet(prev => new Set(prev).add(version.id));

    try {
      const strategy = getStrategy(version.format);
      const svg = await strategy.generatePreview?.(version.code);
      if (svg) {
        setPreviews(prev => new Map(prev).set(version.id, svg));
      }
    } catch {
      // 忽略
    } finally {
      loadingSetRef.current.delete(version.id);
      setLoadingSet(prev => {
        const next = new Set(prev);
        next.delete(version.id);
        return next;
      });
    }
  }, [previews]);

  // IntersectionObserver 懒加载
  useEffect(() => {
    if (!open) return;

    // 等待 DOM 渲染
    const timeout = setTimeout(() => {
      // 抽屉面板自身就是滚动容器
      const scrollContainer = drawerRef.current;
      if (!scrollContainer) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              const versionId = entry.target.getAttribute('data-version-id');
              const version = versions.find(v => v.id === versionId);
              if (version) loadPreview(version);
              observerRef.current?.unobserve(entry.target);
            }
          }
        },
        { root: scrollContainer, threshold: 0.1 }
      );

      // 观察所有卡片
      cardRefs.current.forEach((el) => {
        observerRef.current?.observe(el);
      });
    }, 150);

    return () => {
      clearTimeout(timeout);
      observerRef.current?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, versions]);

  // 注册卡片 ref
  const setCardRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) {
      cardRefs.current.set(id, el);
      // 如果 observer 已存在，立即观察
      if (observerRef.current && !previews.has(id) && !loadingSetRef.current.has(id)) {
        observerRef.current.observe(el);
      }
    } else {
      cardRefs.current.delete(id);
    }
  }, [previews]);

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
              <div
                key={version.id}
                ref={(el) => setCardRef(version.id, el)}
                data-version-id={version.id}
              >
                <VersionCard
                  id={version.id}
                  versionNumber={version.versionNumber}
                  createdAt={version.createdAt}
                  isCurrent={version.id === currentVersionId}
                  svg={previews.get(version.id)}
                  loading={loadingSet.has(version.id)}
                  onSelect={onSelectVersion}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

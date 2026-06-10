'use client';

import { useLocale } from '@/lib/locales';
import VersionThumbnail from './VersionThumbnail';

interface VersionCardProps {
  id: string;
  versionNumber: number;
  createdAt: number;
  isCurrent: boolean;
  svg: string | null | undefined;
  loading: boolean;
  onSelect: (id: string) => void;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export default function VersionCard({ id, versionNumber, createdAt, isCurrent, svg, loading, onSelect }: VersionCardProps) {
  const { t } = useLocale();

  return (
    <button
      onClick={() => onSelect(id)}
      className={`w-full text-left rounded-xl p-3 transition-all duration-200 cursor-pointer group
        ${isCurrent
          ? 'bg-[var(--accent-indigo)]/10 border-2 border-[var(--accent-indigo)]/40'
          : 'bg-[var(--surface-elevated)]/50 border-2 border-transparent hover:border-[var(--border)] hover:bg-[var(--surface-elevated)]'
        }`}
    >
      {/* 版本标题 */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-[var(--text)]">
          {t('versionHistory.version')} {versionNumber}
          <span className="text-xs text-[var(--muted)] ml-2">{formatTime(createdAt)}</span>
        </span>
        {isCurrent && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent-indigo)]/20 text-[var(--accent-indigo)]">
            {t('versionHistory.current')}
          </span>
        )}
      </div>

      {/* 预览 */}
      <VersionThumbnail svg={svg} loading={loading} versionNumber={versionNumber} />
    </button>
  );
}

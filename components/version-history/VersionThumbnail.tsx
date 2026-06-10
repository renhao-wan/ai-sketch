'use client';

import { useLocale } from '@/lib/locales';
import { Loader2 } from 'lucide-react';

interface VersionThumbnailProps {
  svg: string | null | undefined;
  loading: boolean;
  versionNumber: number;
}

export default function VersionThumbnail({ svg, loading, versionNumber }: VersionThumbnailProps) {
  const { t } = useLocale();

  if (loading) {
    return (
      <div className="w-full aspect-[16/10] rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-[var(--muted)]" />
      </div>
    );
  }

  if (svg) {
    return (
      <div
        className="w-full aspect-[16/10] rounded-lg overflow-hidden bg-white border border-[var(--border)] [&>svg]:w-full [&>svg]:h-full [&>svg]:object-contain"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }

  return (
    <div className="w-full aspect-[16/10] rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center">
      <span className="text-xs text-[var(--muted)]">{t('versionHistory.noThumbnail')}</span>
    </div>
  );
}

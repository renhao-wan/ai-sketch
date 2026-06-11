'use client';

import { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { useLocale } from '@/lib/locales';
import { Loader2 } from 'lucide-react';

interface VersionThumbnailProps {
  svg: string | null | undefined;
  loading: boolean;
  versionNumber: number;
}

export default function VersionThumbnail({ svg, loading, versionNumber }: VersionThumbnailProps) {
  const { t } = useLocale();
  const sanitized = useMemo(
    () => svg ? DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true } }) : null,
    [svg]
  );

  if (loading) {
    return (
      <div className="w-full h-40 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-[var(--muted)]" />
      </div>
    );
  }

  if (sanitized) {
    return (
      <div
        className="version-thumbnail w-full rounded-lg overflow-hidden bg-white border border-[var(--border)] flex items-center justify-center"
        style={{ maxHeight: '200px' }}
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    );
  }

  return (
    <div className="w-full h-40 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center">
      <span className="text-xs text-[var(--muted)]">{t('versionHistory.noThumbnail')}</span>
    </div>
  );
}

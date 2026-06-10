'use client';

import { useLocale } from '@/lib/locales';

interface VersionThumbnailProps {
  thumbnail: string | undefined;
  versionNumber: number;
}

export default function VersionThumbnail({ thumbnail, versionNumber }: VersionThumbnailProps) {
  const { t } = useLocale();

  if (thumbnail) {
    return (
      <div className="w-full aspect-[16/10] rounded-lg overflow-hidden bg-[var(--surface)] border border-[var(--border)]">
        <img
          src={thumbnail}
          alt={`${t('versionHistory.version')} ${versionNumber}`}
          className="w-full h-full object-contain"
          draggable={false}
        />
      </div>
    );
  }

  return (
    <div className="w-full aspect-[16/10] rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center">
      <span className="text-xs text-[var(--muted)]">{t('versionHistory.noThumbnail')}</span>
    </div>
  );
}

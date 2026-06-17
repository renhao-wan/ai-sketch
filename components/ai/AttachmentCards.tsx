'use client';

import { Paperclip, X } from 'lucide-react';
import { useLocale } from '@/lib/locales';

interface AttachmentCardsProps {
  attachments: File[];
  imageBlobUrls: Map<File, string>;
  attachStatus: string;
  attachError: string | null;
  onRemove: (index: number) => void;
}

export default function AttachmentCards({
  attachments,
  imageBlobUrls,
  attachStatus,
  attachError,
  onRemove,
}: AttachmentCardsProps) {
  const { t } = useLocale();

  if (attachments.length === 0) return null;

  return (
    <div className={`mt-2 grid gap-2 ${attachments.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
      {attachments.map((file, i) => {
        const isImage = file.type.startsWith('image/');
        return (
          <div key={`${file.name}-${i}`} className="relative flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[var(--surface-warm-hover)] border border-[var(--surface-warm-hover)] group">
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element -- blob URL 不支持 next/image
              <img src={imageBlobUrls.get(file)} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded bg-[var(--surface-warm)] flex items-center justify-center flex-shrink-0">
                <Paperclip size={13} className="text-[var(--muted)]" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-[var(--fg)] truncate">{file.name}</p>
              {attachStatus === 'processing' && <p className="text-[10px] text-[var(--muted)]">{t('upload.processing')}</p>}
              {attachStatus === 'success' && <p className="text-[10px] text-[var(--accent-indigo)]">{t('upload.ready')}</p>}
              {attachStatus === 'error' && <p className="text-[10px] text-red-500">{attachError}</p>}
            </div>
            <button onClick={() => onRemove(i)} className="opacity-0 group-hover:opacity-100 text-[var(--muted)] hover:text-[var(--fg)] transition-all flex-shrink-0">
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

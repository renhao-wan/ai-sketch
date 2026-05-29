'use client';

import dynamic from 'next/dynamic';
import { useLocale } from '@/locales';
import type { DiagramFormat } from '@/types/diagram-strategy';

const ExcalidrawCanvas = dynamic(() => import('./ExcalidrawCanvas'), { ssr: false });
const MermaidCanvas = dynamic(() => import('./MermaidCanvas'), { ssr: false });
const DrawioCanvas = dynamic(() => import('./DrawioCanvas'), { ssr: false });

interface DiagramCanvasProps {
  format: DiagramFormat;
  data: unknown;
}

export default function DiagramCanvas({ format, data }: DiagramCanvasProps) {
  const { t } = useLocale();

  if (data === null || data === undefined) {
    return (
      <div className="w-full h-full flex items-center justify-center canvas-grid-bg">
        <p className="text-sm text-[var(--muted)]">{t('canvas.emptyState')}</p>
      </div>
    );
  }

  switch (format) {
    case 'excalidraw':
      return <ExcalidrawCanvas elements={Array.isArray(data) ? data : []} />;
    case 'mermaid':
      return <MermaidCanvas code={typeof data === 'string' ? data : ''} />;
    case 'drawio':
      return <DrawioCanvas code={typeof data === 'string' ? data : ''} />;
    default:
      return (
        <div className="w-full h-full flex items-center justify-center canvas-grid-bg">
          <p className="text-sm text-[var(--muted)]">{t('canvas.unsupportedFormat')} {format}</p>
        </div>
      );
  }
}

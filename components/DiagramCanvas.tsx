'use client';

import dynamic from 'next/dynamic';
import { useLocale } from '@/locales';
import type { DiagramFormat } from '@/types/diagram-strategy';
import type { ExcalidrawElement } from '@/types';

const ExcalidrawCanvas = dynamic(() => import('./ExcalidrawCanvas'), { ssr: false });
const MermaidCanvas = dynamic(() => import('./MermaidCanvas'), { ssr: false });
const DrawioCanvas = dynamic(() => import('./DrawioCanvas'), { ssr: false });

interface DiagramCanvasProps {
  format: DiagramFormat;
  data: unknown;
}

export default function DiagramCanvas({ format, data }: DiagramCanvasProps) {
  const { t } = useLocale();

  switch (format) {
    case 'excalidraw':
      return <ExcalidrawCanvas elements={(data as ExcalidrawElement[]) || []} />;
    case 'mermaid':
      return <MermaidCanvas code={(data as string) || ''} />;
    case 'drawio':
      return <DrawioCanvas code={(data as string) || ''} />;
    default:
      return (
        <div className="w-full h-full flex items-center justify-center canvas-grid-bg">
          <p className="text-sm text-[var(--muted)]">{t('canvas.unsupportedFormat')} {format}</p>
        </div>
      );
  }
}

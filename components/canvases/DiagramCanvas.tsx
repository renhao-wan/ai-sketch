'use client';

import dynamic from 'next/dynamic';
import type { MutableRefObject } from 'react';
import { useLocale } from '@/locales';
import type { DiagramFormat } from '@/types/diagram-strategy';
import type { StreamRendererRef } from './ExcalidrawCanvas';

const ExcalidrawCanvas = dynamic(() => import('./ExcalidrawCanvas'), { ssr: false });
const MermaidCanvas = dynamic(() => import('./MermaidCanvas'), { ssr: false });
const DrawioCanvas = dynamic(() => import('./DrawioCanvas'), { ssr: false });

interface DiagramCanvasProps {
  format: DiagramFormat;
  data: unknown;
  isStreaming?: boolean;
  streamBuffer?: string;
  streamVersion?: number;
  streamRendererRef?: MutableRefObject<StreamRendererRef | null>;
}

export default function DiagramCanvas({ format, data, isStreaming, streamBuffer, streamVersion, streamRendererRef }: DiagramCanvasProps) {
  const { t } = useLocale();

  // Normalize: extract array from wrapper objects
  let normalized: unknown = data;
  if (data !== null && data !== undefined && typeof data === 'object' && !Array.isArray(data) && 'elements' in (data as Record<string, unknown>)) {
    normalized = (data as Record<string, unknown>).elements;
  }

  const isEmpty = normalized === null || normalized === undefined;

  // Excalidraw needs to stay mounted during streaming for updateScene calls
  const excalidrawAlwaysMounted = format === 'excalidraw' && isStreaming;

  if (isEmpty && !isStreaming && !excalidrawAlwaysMounted) {
    return (
      <div className="w-full h-full flex items-center justify-center canvas-grid-bg">
        <p className="text-sm text-[var(--muted)]">{t('canvas.emptyState')}</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full canvas-grid-bg relative">
      {isStreaming && isEmpty && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="px-5 py-3 rounded-2xl bg-[var(--surface-warm)] backdrop-blur-xl border border-[var(--accent-violet)]/15 shadow-[var(--shadow-floating)] flex items-center gap-3">
            <div className="relative w-5 h-5">
              <div className="absolute inset-0 rounded-full border-2 border-[var(--accent-violet)]/20" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--accent-violet)] animate-spin" />
            </div>
            <span className="text-sm font-medium text-[var(--fg)]">{t('canvas.generating')}</span>
          </div>
        </div>
      )}

      {(!isEmpty || excalidrawAlwaysMounted) && (
        <>
          {format === 'excalidraw' && <ExcalidrawCanvas elements={Array.isArray(normalized) ? normalized : []} isStreaming={isStreaming} streamRendererRef={streamRendererRef} />}
          {format === 'mermaid' && <MermaidCanvas code={typeof normalized === 'string' ? normalized : ''} />}
          {format === 'drawio' && <DrawioCanvas code={typeof normalized === 'string' ? normalized : ''} />}
          {!['excalidraw', 'mermaid', 'drawio'].includes(format) && (
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-sm text-[var(--muted)]">{t('canvas.unsupportedFormat')} {format}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

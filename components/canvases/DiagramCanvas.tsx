'use client';

import dynamic from 'next/dynamic';
import type { MutableRefObject } from 'react';
import { useLocale } from '@/lib/locales';
import type { DiagramFormat } from '@/lib/types/diagram-strategy';
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

  // 按需挂载：根据当前格式提取对应数据
  const excalidrawElements = format === 'excalidraw' && Array.isArray(normalized) ? normalized : [];
  const mermaidCode = format === 'mermaid' && typeof normalized === 'string' ? normalized : '';
  const drawioCode = format === 'drawio' && typeof normalized === 'string' ? normalized : '';

  return (
    <div className="w-full h-full canvas-grid-bg relative">
      {/* 空状态提示 */}
      {isEmpty && !isStreaming && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <p className="text-sm text-[var(--muted)]">{t('canvas.emptyState')}</p>
        </div>
      )}

      {/* 流式加载提示 */}
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

      {/* 按需挂载：只渲染当前格式的 Canvas */}
      <div className="absolute inset-0">
        {format === 'drawio' && <DrawioCanvas code={drawioCode} />}
        {format === 'excalidraw' && (
          <ExcalidrawCanvas elements={excalidrawElements} isStreaming={isStreaming} streamRendererRef={streamRendererRef} />
        )}
        {format === 'mermaid' && <MermaidCanvas code={mermaidCode} isStreaming={isStreaming} />}
      </div>
    </div>
  );
}

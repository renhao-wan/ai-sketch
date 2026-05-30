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

  // 非活跃 canvas 传空数据清空内容，但组件保持挂载
  const excalidrawElements = format === 'excalidraw' && Array.isArray(normalized) ? normalized : [];
  const mermaidCode = format === 'mermaid' && typeof normalized === 'string' ? normalized : '';
  const drawioCode = format === 'drawio' && typeof normalized === 'string' ? normalized : '';

  // 确定各 canvas 的 z-index（Excalidraw 和 Mermaid 不需要 iframe 可见即可初始化）
  const zExcalidraw = format === 'excalidraw' ? 3 : -1;
  const zMermaid = format === 'mermaid' ? 3 : -1;
  const zDrawio = format === 'drawio' ? 3 : -2; // 始终在底层（iframe 需要可见）

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

      {/* 三个 Canvas 始终挂载，用 z-index 控制前后，传空数据清空非活跃内容 */}
      <div className="absolute inset-0" style={{ zIndex: zDrawio }}>
        <DrawioCanvas code={drawioCode} />
      </div>
      <div className="absolute inset-0" style={{ zIndex: zExcalidraw }}>
        <ExcalidrawCanvas elements={excalidrawElements} isStreaming={format === 'excalidraw' ? isStreaming : undefined} streamRendererRef={streamRendererRef} />
      </div>
      <div className="absolute inset-0" style={{ zIndex: zMermaid }}>
        <MermaidCanvas code={mermaidCode} isStreaming={format === 'mermaid' ? isStreaming : undefined} />
      </div>
    </div>
  );
}

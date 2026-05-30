'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocale } from '@/locales';
import { useZoomControls } from '@/hooks/useZoomControls';
import ZoomToolbar from './ZoomToolbar';

interface MermaidCanvasProps {
  code: string;
  isStreaming?: boolean;
}

let mermaidInstance: typeof import('mermaid').default | null = null;
let mermaidInitPromise: Promise<void> | null = null;

async function initMermaid() {
  if (mermaidInstance) return;
  if (mermaidInitPromise) {
    await mermaidInitPromise;
    return;
  }
  mermaidInitPromise = (async () => {
    const mermaid = (await import('mermaid')).default;
    mermaid.initialize({
      startOnLoad: false,
      theme: 'neutral',
      securityLevel: 'loose',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
      themeVariables: {
        fontSize: '14px',
        fontFamily: 'inherit',
        lineColor: '#6b7280',
        primaryColor: '#3b82f6',
        primaryTextColor: '#1f2937',
        primaryBorderColor: '#93c5fd',
        secondaryColor: '#f3f4f6',
        tertiaryColor: '#ffffff',
      },
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis',
        padding: 20,
      },
      sequence: {
        useMaxWidth: true,
        wrap: true,
        messageAlign: 'center',
      },
      gantt: {
        useMaxWidth: true,
      },
    });
    mermaidInstance = mermaid;
  })();
  try {
    await mermaidInitPromise;
  } catch (e) {
    mermaidInitPromise = null; // allow retry on next call
    throw e;
  }
}

export default function MermaidCanvas({ code, isStreaming }: MermaidCanvasProps) {
  const { t } = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const renderIdRef = useRef(0);
  const isStreamingRef = useRef(isStreaming);
  isStreamingRef.current = isStreaming;

  const {
    scale, translate, isPanning,
    handleZoomIn, handleZoomOut, handleFitToView,
    handleWheel, handleMouseDown, handleMouseMove, handleMouseUp,
  } = useZoomControls();

  const handleFitToViewLocal = useCallback(() => {
    if (!containerRef.current || !wrapperRef.current) return;
    const svg = containerRef.current.querySelector('svg');
    if (!svg) return;
    const svgWidth = containerRef.current.scrollWidth;
    const svgHeight = containerRef.current.scrollHeight;
    const wrapperRect = wrapperRef.current.getBoundingClientRect();
    handleFitToView(wrapperRect.width, wrapperRect.height, svgWidth, svgHeight);
  }, [handleFitToView]);

  useEffect(() => {
    if (!containerRef.current) return;

    // 空代码时清空容器
    if (!code) {
      containerRef.current.innerHTML = '';
      setError(null);
      return;
    }

    const currentRenderId = ++renderIdRef.current;

    const renderDiagram = async () => {
      try {
        setError(null);
        await initMermaid();
        if (!mermaidInstance || !containerRef.current) return;
        if (currentRenderId !== renderIdRef.current) return;

        const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const { svg, bindFunctions } = await mermaidInstance.render(id, code);

        if (currentRenderId !== renderIdRef.current) return;
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
          if (bindFunctions) {
            bindFunctions(containerRef.current);
          }
          setError(null);
          // 自动适应视图（75% 容器大小）
          requestAnimationFrame(() => {
            if (!containerRef.current || !wrapperRef.current) return;
            const svgEl = containerRef.current.querySelector('svg');
            if (!svgEl) return;
            const svgWidth = containerRef.current.scrollWidth;
            const svgHeight = containerRef.current.scrollHeight;
            const wrapperRect = wrapperRef.current.getBoundingClientRect();
            handleFitToView(wrapperRect.width, wrapperRect.height, svgWidth, svgHeight);
          });
        }
      } catch (e) {
        if (currentRenderId !== renderIdRef.current) return;
        if (!isStreamingRef.current) {
          const rawMsg = (e as Error).message || t('mermaid.renderFailed');
          const lineMatch = rawMsg.match(/Parse error on line (\d+)(?:, column (\d+))?/);
          const msg = lineMatch
            ? `Line ${lineMatch[1]}${lineMatch[2] ? `, Column ${lineMatch[2]}` : ''}: ${rawMsg.replace(lineMatch[0], '').trim()}`
            : rawMsg;
          setError(msg);
        }
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }
      }
    };

    renderDiagram();

    return () => { renderIdRef.current++; };
  }, [code, t]);

  return (
    <div className="w-full h-full overflow-hidden canvas-grid-bg relative">
      <ZoomToolbar scale={scale} onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} onFitToView={handleFitToViewLocal} />

      {/* 图表容器 */}
      <div
        ref={wrapperRef}
        className="w-full h-full overflow-auto"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isPanning ? 'grabbing' : 'default' }}
      >
        {error ? (
          <div className="w-full h-full flex items-center justify-center p-6">
            <div className="max-w-lg">
              <div className="px-4 py-3 rounded-xl bg-red-50/80 border border-red-200/50">
                <p className="text-xs font-medium text-red-600 mb-1">{t('mermaid.syntaxError')}</p>
                <p className="text-[11px] font-mono text-red-500 break-words whitespace-pre-wrap">{error}</p>
              </div>
            </div>
          </div>
        ) : (
          <div
            ref={containerRef}
            className="mermaid-container p-8 flex items-center justify-center min-h-full"
            style={{
              transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
              transformOrigin: 'center center',
              transition: isPanning ? 'none' : 'transform 0.15s ease-out',
            }}
          />
        )}
      </div>
    </div>
  );
}

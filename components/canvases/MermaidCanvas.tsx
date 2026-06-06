'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocale } from '@/lib/locales';
import { useZoomControls } from '@/hooks/useZoomControls';
import { getMermaidThemeVariables, getCurrentTheme } from '@/lib/utils/theme-utils';
import ZoomToolbar from './ZoomToolbar';

interface MermaidCanvasProps {
  code: string;
  isStreaming?: boolean;
}

let mermaidInstance: typeof import('mermaid').default | null = null;
let mermaidInitPromise: Promise<void> | null = null;
let lastTheme: string | null = null;

async function initMermaid() {
  const currentTheme = getCurrentTheme();

  // 如果主题变化，需要重新初始化
  if (mermaidInstance && lastTheme === currentTheme) return;

  if (mermaidInitPromise) {
    await mermaidInitPromise;
    // 检查主题是否变化
    if (lastTheme === currentTheme) return;
  }

  mermaidInitPromise = (async () => {
    const mermaid = (await import('mermaid')).default;
    mermaid.initialize({
      startOnLoad: false,
      theme: 'neutral',
      securityLevel: 'strict',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
      themeVariables: getMermaidThemeVariables(),
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
    lastTheme = currentTheme;
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
  const rafIdRef = useRef(0);
  const isStreamingRef = useRef(isStreaming);

  // Keep isStreamingRef in sync
  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

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

  // 使用 useCallback 包裹渲染逻辑，避免在 effect 中直接调用 setState
  const renderDiagram = useCallback(async (currentRenderId: number) => {
    try {
      await initMermaid();
      if (!mermaidInstance || !containerRef.current) return;
      if (currentRenderId !== renderIdRef.current) return;

      const id = `mermaid-${crypto.randomUUID()}`;
      const { svg, bindFunctions } = await mermaidInstance.render(id, code);

      if (currentRenderId !== renderIdRef.current) return;
      if (containerRef.current) {
        containerRef.current.innerHTML = svg;
        if (bindFunctions) {
          bindFunctions(containerRef.current);
        }
        // 自动适应视图（75% 容器大小）
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = requestAnimationFrame(() => {
          if (!containerRef.current || !wrapperRef.current) return;
          const svgEl = containerRef.current.querySelector('svg');
          if (!svgEl) return;
          const svgWidth = containerRef.current.scrollWidth;
          const svgHeight = containerRef.current.scrollHeight;
          const wrapperRect = wrapperRef.current.getBoundingClientRect();
          handleFitToView(wrapperRect.width, wrapperRect.height, svgWidth, svgHeight);
        });
      }
      return null; // 成功
    } catch (e) {
      if (currentRenderId !== renderIdRef.current) return null;
      if (!isStreamingRef.current) {
        const rawMsg = (e as Error).message || t('mermaid.renderFailed');
        const lineMatch = rawMsg.match(/Parse error on line (\d+)(?:, column (\d+))?/);
        const msg = lineMatch
          ? `Line ${lineMatch[1]}${lineMatch[2] ? `, Column ${lineMatch[2]}` : ''}: ${rawMsg.replace(lineMatch[0], '').trim()}`
          : rawMsg;
        return msg; // 返回错误信息
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initMermaid 和 mermaidInstance 是模块级变量，不需要作为依赖
  }, [code, initMermaid, mermaidInstance, handleFitToView, t]);

  // 渲染 Mermaid 图表（合理用例，需要在 effect 中处理错误）
  useEffect(() => {
    if (!containerRef.current) return;

    // 空代码时清空容器
    if (!code) {
      containerRef.current.innerHTML = '';
      setError(null);
      return;
    }

    const currentRenderId = ++renderIdRef.current;

    // 清除之前的错误
    setError(null);

    renderDiagram(currentRenderId).then((error) => {
      if (error && currentRenderId === renderIdRef.current) {
        setError(error);
      }
    }).catch(console.error);

    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps -- 故意在 cleanup 中递增 ref 以使进行中的渲染失效
      renderIdRef.current++;
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- renderDiagram 是 useCallback 包裹的函数，不需要作为依赖
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

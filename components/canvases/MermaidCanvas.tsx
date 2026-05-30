'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocale } from '@/locales';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

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

  // 缩放和平移状态
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });

  const handleZoomIn = useCallback(() => {
    setScale(s => Math.min(s + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(s => Math.max(s - 0.25, 0.25));
  }, []);

  const handleFitToView = useCallback(() => {
    if (!containerRef.current || !wrapperRef.current) return;
    const svg = containerRef.current.querySelector('svg');
    if (!svg) return;
    const svgWidth = containerRef.current.scrollWidth;
    const svgHeight = containerRef.current.scrollHeight;
    const wrapperRect = wrapperRef.current.getBoundingClientRect();
    const scaleX = (wrapperRect.width * 0.75) / svgWidth;
    const scaleY = (wrapperRect.height * 0.75) / svgHeight;
    const newScale = Math.min(scaleX, scaleY, 1.5);
    setScale(newScale);
    setTranslate({ x: 0, y: 0 });
  }, []);

  // 鼠标滚轮缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setScale(s => Math.max(0.3, Math.min(3, s + delta)));
    }
  }, []);

  // 鼠标拖拽平移
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      isPanning.current = true;
      panStart.current = { x: e.clientX - translate.x, y: e.clientY - translate.y };
    }
  }, [translate]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning.current) {
      setTranslate({
        x: e.clientX - panStart.current.x,
        y: e.clientY - panStart.current.y,
      });
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  useEffect(() => {
    if (!code || !containerRef.current) return;

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
            // 使用 scrollWidth/scrollHeight 获取 SVG 实际渲染大小
            const svgWidth = containerRef.current.scrollWidth;
            const svgHeight = containerRef.current.scrollHeight;
            const wrapperRect = wrapperRef.current.getBoundingClientRect();
            const scaleX = (wrapperRect.width * 0.75) / svgWidth;
            const scaleY = (wrapperRect.height * 0.75) / svgHeight;
            const newScale = Math.min(scaleX, scaleY, 1.5);
            setScale(newScale);
            setTranslate({ x: 0, y: 0 });
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
      {/* 缩放控制按钮 */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-white/80 backdrop-blur-sm rounded-lg border border-black/[0.08] shadow-sm p-1">
        <button onClick={handleZoomOut} className="p-1.5 hover:bg-black/[0.05] rounded transition-colors" title="缩小">
          <ZoomOut size={14} className="text-[var(--muted)]" />
        </button>
        <span className="text-[11px] text-[var(--muted)] min-w-[40px] text-center font-mono">{Math.round(scale * 100)}%</span>
        <button onClick={handleZoomIn} className="p-1.5 hover:bg-black/[0.05] rounded transition-colors" title="放大">
          <ZoomIn size={14} className="text-[var(--muted)]" />
        </button>
        <div className="w-px h-4 bg-black/[0.08] mx-0.5" />
        <button onClick={handleFitToView} className="p-1.5 hover:bg-black/[0.05] rounded transition-colors" title="适应视图">
          <Maximize2 size={14} className="text-[var(--muted)]" />
        </button>
      </div>

      {/* 图表容器 */}
      <div
        ref={wrapperRef}
        className="w-full h-full overflow-auto"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isPanning.current ? 'grabbing' : 'default' }}
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
              transition: isPanning.current ? 'none' : 'transform 0.15s ease-out',
            }}
          />
        )}
      </div>
    </div>
  );
}

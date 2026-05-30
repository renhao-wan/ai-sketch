'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useLocale } from '@/locales';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface DrawioCanvasProps {
  code: string;
}

const DRAWIO_ORIGIN = 'https://embed.diagrams.net';

function buildLoadPayload(xml: string) {
  return JSON.stringify({
    action: 'load',
    xml,
    autosave: 0,
    noSaveBtn: 1,
    noExitBtn: 1,
    readOnly: 1,
  });
}

export default function DrawioCanvas({ code }: DrawioCanvasProps) {
  const { t } = useLocale();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [embedReady, setEmbedReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeRef = useRef(code);

  // 缩放状态
  const [scale, setScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep codeRef in sync
  codeRef.current = code;

  const handleZoomIn = useCallback(() => {
    setScale(s => Math.min(s + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(s => Math.max(s - 0.25, 0.25));
  }, []);

  const handleFitToView = useCallback(() => {
    setScale(1);
  }, []);

  // 鼠标滚轮缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setScale(s => Math.max(0.25, Math.min(3, s + delta)));
    }
  }, []);

  // 自动适应视图（在 XML 加载后）
  useEffect(() => {
    if (!embedReady || !code) return;
    setScale(1);
  }, [code, embedReady]);

  // Listen for embed protocol messages (init, load, error)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== DRAWIO_ORIGIN) return;

      let data: Record<string, unknown>;
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }

      if (data.event === 'init') {
        setEmbedReady(true);
        setError(null);
      } else if (data.event === 'load') {
        setError(null);
      } else if (data.event === 'error') {
        setError(typeof data.message === 'string' ? data.message : t('drawio.loadError'));
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [t]);

  // Send XML when embed is ready and code changes
  const sendXml = useCallback(() => {
    if (!iframeRef.current || !embedReady) return;
    const code = codeRef.current;
    if (code && (code.includes('</mxGraphModel>') || code.includes('</mxfile>'))) {
      // 有完整 XML，发送给 draw.io
      try {
        iframeRef.current.contentWindow?.postMessage(buildLoadPayload(code), DRAWIO_ORIGIN);
      } catch {
        setError(t('drawio.loadError'));
      }
    } else {
      // 无代码，发送空白图让 draw.io 停止加载动画
      try {
        const emptyXml = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>';
        iframeRef.current.contentWindow?.postMessage(buildLoadPayload(emptyXml), DRAWIO_ORIGIN);
      } catch { /* ignore */ }
    }
  }, [embedReady, t]);

  useEffect(() => {
    if (embedReady) sendXml();
  }, [embedReady, sendXml, code]);

  // Timeout: if embed doesn't signal init within 15s, show error
  useEffect(() => {
    if (embedReady) return;
    const timeout = setTimeout(() => {
      if (!embedReady) {
        setError(t('drawio.loadTimeout'));
      }
    }, 15000);
    return () => clearTimeout(timeout);
  }, [embedReady, t]);

  return (
    <div className="w-full h-full canvas-grid-bg relative overflow-hidden">
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

      {/* 错误提示 */}
      {error && (
        <div className="absolute top-4 left-4 right-4 z-10">
          <div className="px-4 py-3 rounded-xl bg-red-50/80 border border-red-200/50">
            <p className="text-xs font-medium text-red-600 mb-1">{t('drawio.renderError')}</p>
            <p className="text-[11px] text-red-500">{error}</p>
          </div>
        </div>
      )}

      {/* iframe 容器 - 使用 CSS transform 实现缩放 */}
      <div
        ref={containerRef}
        className="w-full h-full"
        onWheel={handleWheel}
        style={{ overflow: scale > 1 ? 'auto' : 'hidden' }}
      >
        <div
          style={{
            width: `${100 / scale}%`,
            height: `${100 / scale}%`,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          <iframe
            ref={iframeRef}
            src={`${DRAWIO_ORIGIN}/?embed=1&proto=json&spin=1&noSaveBtn=1&noExitBtn=1`}
            className="w-full h-full border-0"
            title="Draw.io Viewer"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useLocale } from '@/locales';
import { useZoomControls } from '@/hooks/useZoomControls';
import { useSettings } from '@/hooks/useSettings';
import ZoomToolbar from './ZoomToolbar';

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
  const { settings } = useSettings();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [embedReady, setEmbedReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeRef = useRef(code);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep codeRef in sync
  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  const { scale, handleZoomIn, handleZoomOut, handleSetScale, handleResetTranslate, handleWheel } = useZoomControls();

  const handleFitToView = useCallback(() => {
    handleResetTranslate();
  }, [handleResetTranslate]);

  // 自动适应视图（在 XML 加载后）
  useEffect(() => {
    if (!embedReady || !code) return;
    handleSetScale(1);
  }, [code, embedReady, handleSetScale]);

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
  const sendXml = useCallback((): string | null => {
    if (!iframeRef.current || !embedReady) return null;
    const code = codeRef.current;
    if (code && (code.includes('</mxGraphModel>') || code.includes('</mxfile>'))) {
      // 有完整 XML，发送给 draw.io
      try {
        iframeRef.current.contentWindow?.postMessage(buildLoadPayload(code), DRAWIO_ORIGIN);
        return null;
      } catch {
        return t('drawio.loadError');
      }
    } else {
      // 无代码，发送空白图让 draw.io 停止加载动画
      try {
        const emptyXml = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>';
        iframeRef.current.contentWindow?.postMessage(buildLoadPayload(emptyXml), DRAWIO_ORIGIN);
        return null;
      } catch { return null; }
    }
  }, [embedReady, t]);

  // 发送 XML 到 draw.io（合理用例，需要在 effect 中处理错误）
  useEffect(() => {
    if (embedReady) {
      const error = sendXml();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (error) setError(error);
    }
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
    <div className={`w-full h-full canvas-bg-${settings.canvasBg} relative overflow-hidden`}>
      <ZoomToolbar scale={scale} onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} onFitToView={handleFitToView} />

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

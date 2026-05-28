'use client';

import { useEffect, useRef, useState } from 'react';

interface DrawioCanvasProps {
  code: string;
}

export default function DrawioCanvas({ code }: DrawioCanvasProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!iframeRef.current || !code) return;

    const iframe = iframeRef.current;

    const sendXml = () => {
      try {
        iframe.contentWindow?.postMessage(
          JSON.stringify({
            action: 'load',
            xml: code,
            autosave: 0,
            noSaveBtn: 1,
            noExitBtn: 1,
            readOnly: 1,
          }),
          '*',
        );
        setLoaded(true);
        setError(null);
      } catch (e) {
        setError('无法加载图表到 Draw.io 查看器');
      }
    };

    if (loaded) {
      sendXml();
    }
  }, [code, loaded]);

  const handleLoad = () => {
    setLoaded(true);
    if (code && iframeRef.current) {
      try {
        iframeRef.current.contentWindow?.postMessage(
          JSON.stringify({
            action: 'load',
            xml: code,
            autosave: 0,
            noSaveBtn: 1,
            noExitBtn: 1,
            readOnly: 1,
          }),
          '*',
        );
      } catch {
        setError('无法加载图表到 Draw.io 查看器');
      }
    }
  };

  return (
    <div className="w-full h-full canvas-grid-bg relative">
      {error && (
        <div className="absolute top-4 left-4 right-4 z-10">
          <div className="px-4 py-3 rounded-xl bg-red-50/80 border border-red-200/50">
            <p className="text-xs font-medium text-red-600 mb-1">Draw.io 渲染错误</p>
            <p className="text-[11px] text-red-500">{error}</p>
          </div>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src="https://embed.diagrams.net/?embed=1&proto=json&spin=1&noSaveBtn=1&noExitBtn=1"
        className="w-full h-full border-0"
        title="Draw.io Viewer"
        onLoad={handleLoad}
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}

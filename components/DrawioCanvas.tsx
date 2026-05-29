'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useLocale } from '@/locales';

interface DrawioCanvasProps {
  code: string;
}

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
  const [iframeReady, setIframeReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Timeout detection: if iframe fails to load within 15s, show error
  useEffect(() => {
    if (iframeReady) return;
    const timeout = setTimeout(() => {
      if (!iframeReady) {
        setError(t('drawio.loadTimeout'));
      }
    }, 15000);
    return () => clearTimeout(timeout);
  }, [iframeReady, t]);

  const sendXml = useCallback(() => {
    if (!iframeRef.current || !code) return;
    try {
      iframeRef.current.contentWindow?.postMessage(buildLoadPayload(code), 'https://embed.diagrams.net');
      setError(null);
    } catch {
      setError(t('drawio.loadError'));
    }
  }, [code, t]);

  // Send XML whenever code changes AND iframe is ready
  useEffect(() => {
    if (iframeReady) sendXml();
  }, [iframeReady, sendXml]);

  const handleLoad = () => {
    setIframeReady(true);
  };

  return (
    <div className="w-full h-full canvas-grid-bg relative">
      {error && (
        <div className="absolute top-4 left-4 right-4 z-10">
          <div className="px-4 py-3 rounded-xl bg-red-50/80 border border-red-200/50">
            <p className="text-xs font-medium text-red-600 mb-1">{t('drawio.renderError')}</p>
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
        sandbox="allow-scripts"
      />
    </div>
  );
}

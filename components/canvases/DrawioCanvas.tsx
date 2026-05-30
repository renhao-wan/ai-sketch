'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useLocale } from '@/locales';

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

  // Keep codeRef in sync
  codeRef.current = code;

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
    try {
      iframeRef.current.contentWindow?.postMessage(buildLoadPayload(codeRef.current), DRAWIO_ORIGIN);
    } catch {
      setError(t('drawio.loadError'));
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
        src={`${DRAWIO_ORIGIN}/?embed=1&proto=json&spin=1&noSaveBtn=1&noExitBtn=1`}
        className="w-full h-full border-0"
        title="Draw.io Viewer"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}

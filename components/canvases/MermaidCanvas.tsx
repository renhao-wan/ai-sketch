'use client';

import { useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { useLocale } from '@/locales';

interface MermaidCanvasProps {
  code: string;
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
      theme: 'default',
      securityLevel: 'strict',
      fontFamily: 'inherit',
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

export default function MermaidCanvas({ code }: MermaidCanvasProps) {
  const { t } = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const renderIdRef = useRef(0);

  useEffect(() => {
    if (!code || !containerRef.current) return;

    const currentRenderId = ++renderIdRef.current;

    const renderDiagram = async () => {
      try {
        setError(null); // clear stale error from previous render
        await initMermaid();
        if (!mermaidInstance || !containerRef.current) return;
        if (currentRenderId !== renderIdRef.current) return;

        const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const { svg, bindFunctions } = await mermaidInstance.render(id, code);

        if (currentRenderId !== renderIdRef.current) return;
        if (containerRef.current) {
          containerRef.current.innerHTML = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true } });
          if (bindFunctions) {
            bindFunctions(containerRef.current);
          }
          setError(null);
        }
      } catch (e) {
        if (currentRenderId !== renderIdRef.current) return;
        const rawMsg = (e as Error).message || t('mermaid.renderFailed');
        const lineMatch = rawMsg.match(/Parse error on line (\d+)(?:, column (\d+))?/);
        const msg = lineMatch
          ? `Line ${lineMatch[1]}${lineMatch[2] ? `, Column ${lineMatch[2]}` : ''}: ${rawMsg.replace(lineMatch[0], '').trim()}`
          : rawMsg;
        setError(msg);
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }
      }
    };

    renderDiagram();

    // Cleanup: cancel stale renders early so mermaid.render() can bail out
    return () => { renderIdRef.current++; };
  }, [code, t]);

  return (
    <div className="w-full h-full overflow-auto canvas-grid-bg flex items-center justify-center">
      {error ? (
        <div className="p-6 max-w-lg">
          <div className="px-4 py-3 rounded-xl bg-red-50/80 border border-red-200/50">
            <p className="text-xs font-medium text-red-600 mb-1">{t('mermaid.syntaxError')}</p>
            <p className="text-[11px] font-mono text-red-500 break-words whitespace-pre-wrap">{error}</p>
          </div>
        </div>
      ) : (
        <div ref={containerRef} className="mermaid-container p-8" />
      )}
    </div>
  );
}

'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import '@excalidraw/excalidraw/index.css';
import type { ExcalidrawElement } from '@/types';

const Excalidraw = dynamic(
  async () => (await import('@excalidraw/excalidraw')).Excalidraw,
  { ssr: false },
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ConvertFn = (elements: any[], opts?: { regenerateIds: boolean }) => any[];

let _convertFn: ConvertFn | null = null;
async function loadConvertFn(): Promise<ConvertFn> {
  if (_convertFn) return _convertFn;
  const mod = await import('@excalidraw/excalidraw');
  _convertFn = mod.convertToExcalidrawElements as ConvertFn;
  return _convertFn;
}

const VALID = new Set(['rectangle','ellipse','diamond','text','arrow','line','freedraw','image','frame','webembed','magicframe']);

interface Props {
  elements: ExcalidrawElement[];
}

export default function ExcalidrawCanvas({ elements }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiRef = useRef<any>(null);
  const [convertFn, setConvertFn] = useState<ConvertFn | null>(null);

  // Load converter once
  useEffect(() => {
    loadConvertFn().then(fn => { if (typeof fn === 'function') setConvertFn(() => fn); });
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleAPI = useCallback((api: any) => { apiRef.current = api; }, []);

  // Compute converted elements (re-runs when convertFn loads or elements change)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const converted = useMemo((): any[] => {
    if (!elements?.length || !convertFn) return [];
    const valid = (elements as Record<string, unknown>[])
      .filter(e => e.type && VALID.has(e.type as string));
    if (!valid.length) return [];
    try {
      return convertFn(valid, { regenerateIds: true });
    } catch {
      const result: unknown[] = [];
      for (const el of valid) {
        try { result.push(...convertFn([el], { regenerateIds: true })); }
        catch { /* skip */ }
      }
      return result;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements?.length, convertFn]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const initialData = useMemo(() => ({
    elements: converted as any,
    appState: { viewBackgroundColor: '#FAF8F5', currentItemFontFamily: 1 },
  }), [converted]);

  // Scroll to content after render
  useEffect(() => {
    if (apiRef.current && converted.length > 0) {
      const timer = setTimeout(() => {
        try { apiRef.current?.scrollToContent(converted, { fitToContent: true, animate: true, duration: 300 }); } catch {}
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [converted.length]);

  return (
    <div className="w-full h-full canvas-grid-bg">
      <Excalidraw
        key={converted.length}
        excalidrawAPI={handleAPI}
        initialData={initialData}
      />
    </div>
  );
}

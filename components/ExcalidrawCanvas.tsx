'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useMemo } from 'react';
import '@excalidraw/excalidraw/index.css';
import type { ExcalidrawElement } from '@/types';

const Excalidraw = dynamic(
  async () => (await import('@excalidraw/excalidraw')).Excalidraw,
  { ssr: false },
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ConvertFunction = (elements: any[]) => any[];

const getConvertFunction = async (): Promise<ConvertFunction> => {
  const excalidrawModule = await import('@excalidraw/excalidraw');
  return excalidrawModule.convertToExcalidrawElements as ConvertFunction;
};

interface ExcalidrawCanvasProps {
  elements: ExcalidrawElement[];
}

export default function ExcalidrawCanvas({ elements }: ExcalidrawCanvasProps) {
  const [convertToExcalidrawElements, setConvertFunction] = useState<ConvertFunction | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);

  useEffect(() => {
    getConvertFunction().then(fn => setConvertFunction(() => fn));
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const convertedElements = useMemo((): any[] => {
    if (!elements || elements.length === 0 || !convertToExcalidrawElements) return [];
    try { return convertToExcalidrawElements(elements); }
    catch (error) { console.error('Failed to convert elements:', error); return []; }
  }, [elements, convertToExcalidrawElements]);

  useEffect(() => {
    if (excalidrawAPI && convertedElements.length > 0) {
      setTimeout(() => {
        excalidrawAPI.scrollToContent(convertedElements, { fitToContent: true, animate: true, duration: 300 });
      }, 100);
    }
  }, [excalidrawAPI, convertedElements]);

  const canvasKey = useMemo(() => {
    if (convertedElements.length === 0) return 'empty';
    return JSON.stringify(convertedElements.map((el: { id?: string }) => el.id)).slice(0, 50);
  }, [convertedElements]);

  return (
    <div className="w-full h-full canvas-grid-bg">
      <Excalidraw
        key={canvasKey}
        excalidrawAPI={(api: unknown) => setExcalidrawAPI(api)}
        initialData={{
          elements: convertedElements,
          appState: {
            viewBackgroundColor: '#F7F8FA',
            currentItemFontFamily: 1,
          },
          scrollToContent: true,
        }}
      />
    </div>
  );
}

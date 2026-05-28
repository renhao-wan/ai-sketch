'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useMemo } from 'react';
import '@excalidraw/excalidraw/index.css';

const Excalidraw = dynamic(
  async () => (await import('@excalidraw/excalidraw')).Excalidraw,
  { ssr: false }
);

const getConvertFunction = async () => {
  const excalidrawModule = await import('@excalidraw/excalidraw');
  return excalidrawModule.convertToExcalidrawElements;
};

export default function ExcalidrawCanvas({ elements }) {
  const [convertToExcalidrawElements, setConvertFunction] = useState(null);
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);

  useEffect(() => {
    getConvertFunction().then(fn => setConvertFunction(() => fn));
  }, []);

  const convertedElements = useMemo(() => {
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
    return JSON.stringify(convertedElements.map(el => el.id)).slice(0, 50);
  }, [convertedElements]);

  return (
    <div className="w-full h-full canvas-grid-bg">
      <Excalidraw
        key={canvasKey}
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
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

'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useRef } from 'react';
import '@excalidraw/excalidraw/index.css';
import { useLocale } from '@/locales';
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
  const { t } = useLocale();
  const [convertToExcalidrawElements, setConvertFunction] = useState<ConvertFunction | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [conversionError, setConversionError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [convertedElements, setConvertedElements] = useState<any[]>([]);
  const [canvasKey, setCanvasKey] = useState(0);

  useEffect(() => {
    getConvertFunction().then(fn => setConvertFunction(() => fn));
  }, []);

  // Convert elements via useEffect (not useMemo) to avoid setState-during-render
  useEffect(() => {
    if (!elements || elements.length === 0 || !convertToExcalidrawElements) {
      setConvertedElements([]);
      setConversionError(null);
      return;
    }
    try {
      const result = convertToExcalidrawElements(elements);
      setConvertedElements(result);
      setConversionError(null);
    } catch (error) {
      console.error('Failed to convert elements:', error);
      setConversionError((error as Error).message || t('excalidraw.convertError'));
      setConvertedElements([]);
    }
  }, [elements, convertToExcalidrawElements, t]);

  // Increment key when elements change to force Excalidraw remount
  useEffect(() => {
    if (convertedElements.length > 0) {
      setCanvasKey(k => k + 1);
    }
  }, [convertedElements]);

  // Scroll to content with cleanup
  useEffect(() => {
    if (excalidrawAPI && convertedElements.length > 0) {
      const timer = setTimeout(() => {
        excalidrawAPI.scrollToContent(convertedElements, { fitToContent: true, animate: true, duration: 300 });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [excalidrawAPI, convertedElements]);

  return (
    <div className="w-full h-full canvas-grid-bg relative">
      {conversionError && (
        <div className="absolute top-4 left-4 right-4 z-10">
          <div className="px-4 py-3 rounded-xl bg-red-50/80 border border-red-200/50">
            <p className="text-xs font-medium text-red-600 mb-1">{t('excalidraw.convertError')}</p>
            <p className="text-[11px] text-red-500 break-words whitespace-pre-wrap">{conversionError}</p>
          </div>
        </div>
      )}
      <Excalidraw
        key={canvasKey.toString()}
        excalidrawAPI={(api: unknown) => setExcalidrawAPI(api)}
        initialData={{
          elements: convertedElements,
          appState: {
            viewBackgroundColor: '#FAF8F5',
            currentItemFontFamily: 1,
          },
        }}
      />
    </div>
  );
}

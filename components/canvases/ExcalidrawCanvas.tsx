'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import '@excalidraw/excalidraw/index.css';
import type { ExcalidrawElement } from '@/lib/types';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { CanvasExportHandle } from './DiagramCanvas';
import { getExcalidrawBackgroundColor } from '@/lib/utils/theme-utils';
import { useNotification } from '@/lib/contexts/NotificationContext';
import { useLocale } from '@/lib/locales';

const Excalidraw = dynamic(
  async () => (await import('@excalidraw/excalidraw')).Excalidraw,
  { ssr: false },
);

/**
 * Excalidraw 内部元素类型（比本地 ExcalidrawElement 更完整）
 * 用于 convertToExcalidrawElements 的返回值和 updateScene 的参数
 */
 
type ExcalidrawSceneElement = Record<string, any>;

/** convertToExcalidrawElements 的函数签名 */
type ConvertFn = (elements: ExcalidrawElement[], opts?: { regenerateIds: boolean }) => ExcalidrawSceneElement[];

/** 流式渲染配置常量 */
const STREAM_CONFIG = {
  /** debounce 延迟时间（毫秒） */
  UPDATE_DEBOUNCE_MS: 150,
  /** 最大失败元素提示数量 */
  MAX_FAILED_ELEMENTS_DISPLAY: 5,
} as const;

let _convertFn: ConvertFn | null = null;
let _convertFnPromise: Promise<ConvertFn> | null = null;
function loadConvertFn(): Promise<ConvertFn> {
  if (_convertFn) return Promise.resolve(_convertFn);
  if (!_convertFnPromise) {
    _convertFnPromise = import('@excalidraw/excalidraw').then(mod => {
      _convertFn = mod.convertToExcalidrawElements as ConvertFn;
      return _convertFn;
    }).catch(e => {
      // 加载失败时重置 Promise，允许重试
      _convertFnPromise = null;
      throw e;
    });
  }
  return _convertFnPromise;
}

loadConvertFn().catch(() => { /* 预加载失败，组件内会重试 */ });

const VALID = new Set(['rectangle','ellipse','diamond','text','arrow','line','freedraw','image','frame','webembed','magicframe']);
const ARROW_TYPES = new Set(['arrow', 'line']);

// ─── Arrow position computation ───

function getEdgeCenter(el: Record<string, unknown>, edge: string): { x: number; y: number } {
  const x = (el.x as number) || 0, y = (el.y as number) || 0;
  const w = (el.width as number) || 100, h = (el.height as number) || 100;
  switch (edge) {
    case 'left':   return { x, y: y + h / 2 };
    case 'right':  return { x: x + w, y: y + h / 2 };
    case 'top':    return { x: x + w / 2, y };
    case 'bottom': return { x: x + w / 2, y: y + h };
    default:       return { x: x + w, y: y + h / 2 };
  }
}

function determineEdges(s: Record<string, unknown>, e: Record<string, unknown>): { sEdge: string; eEdge: string } {
  const sx = (s.x as number) || 0, sy = (s.y as number) || 0;
  const sw = (s.width as number) || 100, sh = (s.height as number) || 100;
  const ex = (e.x as number) || 0, ey = (e.y as number) || 0;
  const ew = (e.width as number) || 100, eh = (e.height as number) || 100;
  const dx = (sx + sw / 2) - (ex + ew / 2), dy = (sy + sh / 2) - (ey + eh / 2);
  const l2r = sx - (ex + ew), r2l = -((sx + sw) - ex);
  const t2b = sy - (ey + eh), b2t = -((sy + sh) - ey);

  if (dx > 0 && dy > 0) return l2r > t2b ? { sEdge: 'left', eEdge: 'right' } : { sEdge: 'top', eEdge: 'bottom' };
  if (dx < 0 && dy > 0) return r2l > t2b ? { sEdge: 'right', eEdge: 'left' } : { sEdge: 'top', eEdge: 'bottom' };
  if (dx > 0 && dy < 0) return l2r > b2t ? { sEdge: 'left', eEdge: 'right' } : { sEdge: 'bottom', eEdge: 'top' };
  if (dx < 0 && dy < 0) return r2l > b2t ? { sEdge: 'right', eEdge: 'left' } : { sEdge: 'bottom', eEdge: 'top' };
  if (dx === 0 && dy > 0) return { sEdge: 'top', eEdge: 'bottom' };
  if (dx === 0 && dy < 0) return { sEdge: 'bottom', eEdge: 'top' };
  if (dx > 0) return { sEdge: 'left', eEdge: 'right' };
  if (dx < 0) return { sEdge: 'right', eEdge: 'left' };
  return { sEdge: 'right', eEdge: 'left' };
}

/**
 * 处理箭头/线条的流式渲染。
 * - 两个目标都在 idMap 中 → 去掉 id 引用，计算坐标，返回处理后的元素
 * - 目标不全 → 返回 null（跳过，等最终渲染处理）
 */
function positionArrow(arrow: Record<string, unknown>, idMap: Map<string, Record<string, unknown>>): Record<string, unknown> | null {
  const startRef = arrow.start as Record<string, unknown> | undefined;
  const endRef = arrow.end as Record<string, unknown> | undefined;

  const startIsId = !!startRef?.id;
  const endIsId = !!endRef?.id;

  // 没有 id 引用，直接返回原元素
  if (!startIsId && !endIsId) return arrow;

  const startEl = startIsId ? idMap.get(startRef!.id as string) : null;
  const endEl = endIsId ? idMap.get(endRef!.id as string) : null;

  // 目标不全，跳过（返回 null）
  if (!startEl || !endEl) return null;

  // 两个目标都在，去掉 id 引用并计算坐标
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(arrow)) {
    if (key === 'start' || key === 'end') continue;
    result[key] = val;
  }

  const { sEdge, eEdge } = determineEdges(startEl, endEl);
  const sc = getEdgeCenter(startEl, sEdge);
  const ec = getEdgeCenter(endEl, eEdge);
  result.x = sc.x;
  result.y = sc.y;
  result.width = (ec.x - sc.x) || 1;
  result.height = ec.y - sc.y;
  result.points = [[0, 0], [result.width as number, result.height as number]];

  return result;
}

// ─── Component ───

export interface StreamRendererRef {
  feed: (buffer: string) => void;
  reset: () => void;
}

interface Props {
  elements: ExcalidrawElement[];
  isStreaming?: boolean;
  streamRendererRef?: React.MutableRefObject<StreamRendererRef | null>;
  exportRef?: React.MutableRefObject<CanvasExportHandle | null>;
}

export default function ExcalidrawCanvas({ elements, isStreaming, exportRef }: Props) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const [apiReady, setApiReady] = useState(false);
  const [convertFn, setConvertFn] = useState<ConvertFn | null>(null);
  const { showNotification } = useNotification();
  const { t } = useLocale();

  // 计算 elements 内容哈希，用于检测变化
  const elementsHash = useMemo(() => {
    if (!elements?.length) return '';
    return JSON.stringify(elements);
  }, [elements]);

  const failedElementsRef = useRef<Array<{ id: string; error: string }>>([]);

  useEffect(() => {
    loadConvertFn()
      .then(fn => { if (typeof fn === 'function') setConvertFn(() => fn); })
      .catch(console.error);
  }, []);

  const handleAPI = useCallback((api: ExcalidrawImperativeAPI) => {
    apiRef.current = api;
    setApiReady(true);
  }, []);

  // 注册导出函数
  useEffect(() => {
    if (!exportRef || !apiReady || !apiRef.current) return;
    const api = apiRef.current;

    exportRef.current = {
      exportAs: async (format) => {
        const elements = api.getSceneElements();
        if (!elements.length) throw new Error('画布为空');

        if (format === 'svg') {
          const { exportToSvg } = await import('@excalidraw/excalidraw');
          const svg = await exportToSvg({
            elements,
            appState: {
              viewBackgroundColor: '#ffffff',
              exportWithDarkMode: false,
            },
            files: null,
          });
          return new Blob([svg.outerHTML], { type: 'image/svg+xml' });
        }

        // PNG
        const { exportToBlob } = await import('@excalidraw/excalidraw');
        const blob = await exportToBlob({
          elements,
          appState: {
            viewBackgroundColor: '#ffffff',
            exportWithDarkMode: false,
          },
          files: null,
          mimeType: 'image/png',
        });
        return blob;
      },
    };

    return () => { exportRef.current = null; };
  }, [apiReady, exportRef]);

  const initialData = useMemo(() => ({
    elements: [],
    appState: { viewBackgroundColor: getExcalidrawBackgroundColor(), currentItemFontFamily: 1 },
  }), []);

  // 流结束后一次性渲染
  useEffect(() => {
    if (isStreaming || !convertFn || !apiRef.current || !apiReady) return;

    // 空元素时清空画布
    if (!elements?.length) {
      apiRef.current.updateScene({ elements: [] });
      return;
    }

    const valid = (elements as ExcalidrawElement[])
      .filter(e => e.type && VALID.has(e.type));
    if (!valid.length) return;

    let converted: ExcalidrawSceneElement[];
    try {
      converted = convertFn(valid, { regenerateIds: true });
    } catch {
      converted = [];
      for (const el of valid) {
        try { converted.push(...convertFn([el], { regenerateIds: true })); }
        catch (e) {
          // 收集失败的元素
          const id = (el as Record<string, unknown>).id as string || 'unknown';
          failedElementsRef.current.push({
            id,
            error: (e as Error).message || '未知错误',
          });
          console.warn(`[ExcalidrawCanvas] 最终渲染元素转换失败: ${id}`, e);
        }
      }
    }

    if (converted.length > 0) {
      // 先清空再设置，强制触发重新渲染
      apiRef.current.updateScene({ elements: [] });
      // 使用 requestAnimationFrame 确保清空操作完成后再设置新元素
      requestAnimationFrame(() => {
        if (apiRef.current) {
          apiRef.current.updateScene({ elements: converted as any });
          // 只在流结束后调用一次 scrollToContent
          apiRef.current.scrollToContent(converted as any, { fitToContent: true, animate: false });
        }
      });
    }

    // 显示失败元素的警告提示
    const failedCount = failedElementsRef.current.length;
    if (failedCount > 0) {
      const failedIds = failedElementsRef.current
        .slice(0, STREAM_CONFIG.MAX_FAILED_ELEMENTS_DISPLAY)
        .map(f => f.id)
        .join('、');
      const suffix = failedCount > STREAM_CONFIG.MAX_FAILED_ELEMENTS_DISPLAY
        ? ` 等 ${failedCount} 个`
        : ` ${failedCount} 个`;
      showNotification(
        t('notification.partialGenerationFailed'),
        t('notification.elementsFailed', { elements: failedIds + suffix }),
        'warning',
      );
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elementsHash, isStreaming, convertFn, showNotification, t, apiReady]);

  return (
    <div className="w-full h-full canvas-grid-bg">
      <Excalidraw
        excalidrawAPI={handleAPI}
        initialData={initialData}
      />
    </div>
  );
}

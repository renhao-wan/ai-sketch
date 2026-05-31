'use client';

import { useState, useCallback, useRef } from 'react';

interface UseZoomControlsOptions {
  minScale?: number;
  maxScale?: number;
  step?: number;
}

/**
 * 缩放控制 hook
 * 提供缩放、滚轮缩放、鼠标拖拽平移等功能
 */
export function useZoomControls(options: UseZoomControlsOptions = {}) {
  const { minScale = 0.25, maxScale = 3, step = 0.25 } = options;
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });

  const handleZoomIn = useCallback(() => {
    setScale(s => Math.min(s + step, maxScale));
  }, [step, maxScale]);

  const handleZoomOut = useCallback(() => {
    setScale(s => Math.max(s - step, minScale));
  }, [step, minScale]);

  const handleSetScale = useCallback((newScale: number) => {
    setScale(Math.max(minScale, Math.min(maxScale, newScale)));
  }, [minScale, maxScale]);

  const handleResetTranslate = useCallback(() => {
    setTranslate({ x: 0, y: 0 });
  }, []);

  const handleFitToView = useCallback((containerWidth: number, containerHeight: number, contentWidth: number, contentHeight: number, maxFitScale = 1.5) => {
    const scaleX = (containerWidth * 0.75) / contentWidth;
    const scaleY = (containerHeight * 0.75) / contentHeight;
    const newScale = Math.min(scaleX, scaleY, maxFitScale);
    setScale(newScale);
    setTranslate({ x: 0, y: 0 });
  }, []);

  // 鼠标滚轮缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setScale(s => Math.max(minScale, Math.min(maxScale, s + delta)));
    }
  }, [minScale, maxScale]);

  // 鼠标拖拽平移
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      panStart.current = { x: e.clientX - translate.x, y: e.clientY - translate.y };
    }
  }, [translate]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setTranslate({
        x: e.clientX - panStart.current.x,
        y: e.clientY - panStart.current.y,
      });
    }
  }, [isPanning]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  return {
    scale,
    translate,
    isPanning,
    handleZoomIn,
    handleZoomOut,
    handleSetScale,
    handleResetTranslate,
    handleFitToView,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
}

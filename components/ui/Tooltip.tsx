'use client';

import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  children: ReactNode;
  content: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  delay?: number;
}

export default function Tooltip({
  children,
  content,
  side = 'top',
  align = 'center',
  delay = 300,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const gap = 8;
    const tooltipWidth = tooltipRef.current?.offsetWidth || 0;
    const tooltipHeight = tooltipRef.current?.offsetHeight || 0;

    let top = 0;
    let left = 0;

    switch (side) {
      case 'top':
        top = rect.top - gap - tooltipHeight;
        left = align === 'start' ? rect.left : align === 'end' ? rect.right - tooltipWidth : (rect.left + rect.right) / 2 - tooltipWidth / 2;
        break;
      case 'bottom':
        top = rect.bottom + gap;
        left = align === 'start' ? rect.left : align === 'end' ? rect.right - tooltipWidth : (rect.left + rect.right) / 2 - tooltipWidth / 2;
        break;
      case 'left':
        top = align === 'start' ? rect.top : align === 'end' ? rect.bottom - tooltipHeight : (rect.top + rect.bottom) / 2 - tooltipHeight / 2;
        left = rect.left - gap - tooltipWidth;
        break;
      case 'right':
        top = align === 'start' ? rect.top : align === 'end' ? rect.bottom - tooltipHeight : (rect.top + rect.bottom) / 2 - tooltipHeight / 2;
        left = rect.right + gap;
        break;
    }

    setPosition({ top, left });
  }, [side, align]);

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  /* eslint-disable react-hooks/set-state-in-effect -- tooltip 可见时需要计算位置 */
  useEffect(() => {
    if (isVisible) {
      calculatePosition();
    }
  }, [isVisible, calculatePosition]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const getTransform = () => {
    switch (side) {
      case 'top':
      case 'bottom':
      case 'left':
      case 'right':
        return 'none';
    }
  };

  const getArrowStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'absolute',
      width: '8px',
      height: '8px',
      backgroundColor: 'var(--bg-glass)',
      border: '1px solid var(--border)',
      transform: 'rotate(45deg)',
    };

    switch (side) {
      case 'top':
        return { ...base, bottom: '-5px', left: 'calc(50% - 4px)' };
      case 'bottom':
        return { ...base, top: '-5px', left: 'calc(50% - 4px)' };
      case 'left':
        return { ...base, right: '-5px', top: 'calc(50% - 4px)' };
      case 'right':
        return { ...base, left: '-5px', top: 'calc(50% - 4px)' };
    }
  };

  const getArrowBorderClass = () => {
    switch (side) {
      case 'top': return 'border-r border-b';
      case 'bottom': return 'border-l border-t';
      case 'left': return 'border-r border-t';
      case 'right': return 'border-l border-b';
    }
  };

  const tooltipContent = isVisible ? createPortal(
    <div
      ref={tooltipRef}
      className="fixed z-[9999] px-3 py-1.5 text-xs font-medium text-[var(--fg)] bg-[var(--bg-glass)] backdrop-blur-xl border border-[var(--border)] rounded-lg shadow-[0_4px_20px_rgba(28,25,23,0.08)] whitespace-nowrap pointer-events-none animate-tooltip-fade-in text-center"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
      role="tooltip"
    >
      {content}
      <div
        className={`absolute w-2 h-2 bg-[var(--bg-glass)] border-[var(--border)] ${getArrowBorderClass()}`}
        style={getArrowStyle()}
      />
    </div>,
    document.body
  ) : null;

  return (
    <div
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {tooltipContent}
    </div>
  );
}

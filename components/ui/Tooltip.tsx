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

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const gap = 8;

    let top = 0;
    let left = 0;

    switch (side) {
      case 'top':
        top = rect.top - gap;
        left = align === 'start' ? rect.left : align === 'end' ? rect.right : (rect.left + rect.right) / 2;
        break;
      case 'bottom':
        top = rect.bottom + gap;
        left = align === 'start' ? rect.left : align === 'end' ? rect.right : (rect.left + rect.right) / 2;
        break;
      case 'left':
        top = align === 'start' ? rect.top : align === 'end' ? rect.bottom : (rect.top + rect.bottom) / 2;
        left = rect.left - gap;
        break;
      case 'right':
        top = align === 'start' ? rect.top : align === 'end' ? rect.bottom : (rect.top + rect.bottom) / 2;
        left = rect.right + gap;
        break;
    }

    setPosition({ top, left });
  }, [side, align]);

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      calculatePosition();
      setIsVisible(true);
    }, delay);
  };

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
        return align === 'center' ? 'translate(-50%, -100%)' : align === 'end' ? 'translate(-100%, -100%)' : 'translate(0, -100%)';
      case 'bottom':
        return align === 'center' ? 'translate(-50%, 0)' : align === 'end' ? 'translate(-100%, 0)' : 'translate(0, 0)';
      case 'left':
        return align === 'center' ? 'translate(-100%, -50%)' : align === 'end' ? 'translate(-100%, -100%)' : 'translate(-100%, 0)';
      case 'right':
        return align === 'center' ? 'translate(0, -50%)' : align === 'end' ? 'translate(0, -100%)' : 'translate(0, 0)';
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
        return { ...base, bottom: '-5px', left: align === 'center' ? '50%' : align === 'end' ? '12px' : undefined, right: align === 'start' ? '12px' : undefined, transform: align === 'center' ? 'translateX(-50%) rotate(45deg)' : 'rotate(45deg)' };
      case 'bottom':
        return { ...base, top: '-5px', left: align === 'center' ? '50%' : align === 'end' ? '12px' : undefined, right: align === 'start' ? '12px' : undefined, transform: align === 'center' ? 'translateX(-50%) rotate(45deg)' : 'rotate(45deg)' };
      case 'left':
        return { ...base, right: '-5px', top: align === 'center' ? '50%' : align === 'end' ? '12px' : undefined, bottom: align === 'start' ? '12px' : undefined, transform: align === 'center' ? 'translateY(-50%) rotate(45deg)' : 'rotate(45deg)' };
      case 'right':
        return { ...base, left: '-5px', top: align === 'center' ? '50%' : align === 'end' ? '12px' : undefined, bottom: align === 'start' ? '12px' : undefined, transform: align === 'center' ? 'translateY(-50%) rotate(45deg)' : 'rotate(45deg)' };
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
      className="fixed z-[9999] px-3 py-1.5 text-xs font-medium text-[var(--fg)] bg-[var(--bg-glass)] backdrop-blur-xl border border-[var(--border)] rounded-lg shadow-[0_4px_20px_rgba(28,25,23,0.08)] whitespace-nowrap pointer-events-none animate-fade-in"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: getTransform(),
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

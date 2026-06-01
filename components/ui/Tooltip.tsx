'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';

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
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
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

  const positionStyle: Record<string, React.CSSProperties> = {
    top: {
      bottom: '100%',
      marginBottom: '8px',
      ...(align === 'start' ? { left: 0 } : align === 'end' ? { right: 0 } : { left: '50%', transform: 'translateX(-50%)' }),
    },
    bottom: {
      top: '100%',
      marginTop: '8px',
      ...(align === 'start' ? { left: 0 } : align === 'end' ? { right: 0 } : { left: '50%', transform: 'translateX(-50%)' }),
    },
    left: {
      right: '100%',
      marginRight: '8px',
      ...(align === 'start' ? { top: 0 } : align === 'end' ? { bottom: 0 } : { top: '50%', transform: 'translateY(-50%)' }),
    },
    right: {
      left: '100%',
      marginLeft: '8px',
      ...(align === 'start' ? { top: 0 } : align === 'end' ? { bottom: 0 } : { top: '50%', transform: 'translateY(-50%)' }),
    },
  };

  const animationClasses = {
    top: 'animate-fade-in-down',
    bottom: 'animate-fade-in-up',
    left: 'animate-fade-in-right',
    right: 'animate-fade-in-left',
  };

  const arrowStyle: Record<string, React.CSSProperties> = {
    top: {
      bottom: '-5px',
      ...(align === 'start' ? { left: '12px' } : align === 'end' ? { right: '12px' } : { left: '50%', transform: 'translateX(-50%)' }),
    },
    bottom: {
      top: '-5px',
      ...(align === 'start' ? { left: '12px' } : align === 'end' ? { right: '12px' } : { left: '50%', transform: 'translateX(-50%)' }),
    },
    left: {
      right: '-5px',
      ...(align === 'start' ? { top: '12px' } : align === 'end' ? { bottom: '12px' } : { top: '50%', transform: 'translateY(-50%)' }),
    },
    right: {
      left: '-5px',
      ...(align === 'start' ? { top: '12px' } : align === 'end' ? { bottom: '12px' } : { top: '50%', transform: 'translateY(-50%)' }),
    },
  };

  const arrowBorderClasses: Record<string, string> = {
    top: 'border-r border-b',
    bottom: 'border-l border-t',
    left: 'border-r border-t',
    right: 'border-l border-b',
  };

  return (
    <div
      ref={containerRef}
      className="relative inline-flex"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {isVisible && (
        <div
          className={`
            absolute z-50 px-3 py-1.5
            text-xs font-medium text-[var(--fg)]
            bg-[var(--bg-glass)] backdrop-blur-xl
            border border-[var(--border)]
            rounded-lg
            shadow-[0_4px_20px_rgba(28,25,23,0.08)]
            whitespace-nowrap
            pointer-events-none
            ${animationClasses[side]}
          `}
          style={positionStyle[side]}
          role="tooltip"
        >
          {content}
          <div
            className={`absolute w-2 h-2 bg-[var(--bg-glass)] border-[var(--border)] rotate-45 ${arrowBorderClasses[side]}`}
            style={arrowStyle[side]}
          />
        </div>
      )}
    </div>
  );
}

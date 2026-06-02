'use client';

import { useState, useRef, useCallback, type ReactNode, type UIEvent } from 'react';
import { ArrowUp } from 'lucide-react';
import { useLocale } from '@/lib/locales';
import Tooltip from '@/components/ui/Tooltip';

interface ScrollToTopProps {
  children: ReactNode;
  className?: string;
  threshold?: number;
  onScroll?: (e: UIEvent<HTMLDivElement>) => void;
}

export default function ScrollToTop({ children, className, threshold = 200, onScroll }: ScrollToTopProps) {
  const { t } = useLocale();
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    setShow((e.target as HTMLDivElement).scrollTop > threshold);
    onScroll?.(e);
  }, [threshold, onScroll]);

  const scrollToTop = () => {
    ref.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="relative flex flex-col flex-1 min-h-0">
      <div ref={ref} onScroll={handleScroll} className={`flex-1 min-h-0 overflow-y-auto ${className || ''}`}>
        {children}
      </div>
      {show && (
        <Tooltip content={t('scrollToTop')} side="top">
          <button
            onClick={scrollToTop}
            className="absolute bottom-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-[var(--btn-primary)] text-[var(--btn-primary-text)] shadow-lg hover:bg-[var(--btn-primary-hover)] active:scale-95 transition-all duration-200 z-10"
          >
            <ArrowUp size={16} />
          </button>
        </Tooltip>
      )}
    </div>
  );
}

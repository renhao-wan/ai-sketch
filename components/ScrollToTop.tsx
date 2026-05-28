'use client';

import { useState, useRef, useCallback, type ReactNode, type UIEvent } from 'react';
import { ArrowUp } from 'lucide-react';

interface ScrollToTopProps {
  children: ReactNode;
  className?: string;
  threshold?: number;
}

export default function ScrollToTop({ children, className, threshold = 200 }: ScrollToTopProps) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    setShow((e.target as HTMLDivElement).scrollTop > threshold);
  }, [threshold]);

  const scrollToTop = () => {
    ref.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="relative flex flex-col flex-1 min-h-0">
      <div ref={ref} onScroll={handleScroll} className={`flex-1 min-h-0 overflow-y-auto ${className || ''}`}>
        {children}
      </div>
      {show && (
        <button
          onClick={scrollToTop}
          className="absolute bottom-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-lg hover:bg-[var(--primary)]/90 active:scale-95 transition-all duration-200 z-10"
          title="回到顶部"
        >
          <ArrowUp size={16} />
        </button>
      )}
    </div>
  );
}

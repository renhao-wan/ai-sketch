'use client';

import { AppIcon } from './TopBar';

interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  transparent?: boolean;
  className?: string;
}

export default function LoadingOverlay({
  isVisible,
  message = '处理中...',
  transparent = false,
  className = '',
}: LoadingOverlayProps) {
  if (!isVisible) return null;

  return (
    <div
      className={`absolute inset-0 z-50 flex items-center justify-center ${
        transparent ? 'bg-black/5 backdrop-blur-sm' : 'bg-white/80 backdrop-blur-xl'
      } ${className}`}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <div className="animate-pulse-glow rounded-[16px]">
            <AppIcon size={40} />
          </div>
        </div>
        <span className="text-sm text-[var(--muted)] font-medium">{message}</span>
      </div>
    </div>
  );
}

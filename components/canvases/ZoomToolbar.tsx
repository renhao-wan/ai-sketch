'use client';

import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface ZoomToolbarProps {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToView: () => void;
}

/**
 * 缩放控制工具栏
 * 显示缩放百分比和缩放/适应视图按钮
 */
export default function ZoomToolbar({ scale, onZoomIn, onZoomOut, onFitToView }: ZoomToolbarProps) {
  return (
    <div className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-white/80 backdrop-blur-sm rounded-lg border border-black/[0.08] shadow-sm p-1">
      <button onClick={onZoomOut} className="p-1.5 hover:bg-black/[0.05] rounded transition-colors" title="缩小">
        <ZoomOut size={14} className="text-[var(--muted)]" />
      </button>
      <span className="text-[11px] text-[var(--muted)] min-w-[40px] text-center font-mono">{Math.round(scale * 100)}%</span>
      <button onClick={onZoomIn} className="p-1.5 hover:bg-black/[0.05] rounded transition-colors" title="放大">
        <ZoomIn size={14} className="text-[var(--muted)]" />
      </button>
      <div className="w-px h-4 bg-black/[0.08] mx-0.5" />
      <button onClick={onFitToView} className="p-1.5 hover:bg-black/[0.05] rounded transition-colors" title="适应视图">
        <Maximize2 size={14} className="text-[var(--muted)]" />
      </button>
    </div>
  );
}

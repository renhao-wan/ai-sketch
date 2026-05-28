'use client';

import {
  MousePointer2,
  Hand,
  Type,
  Square,
  ArrowUpRight,
  Minus,
  ImageIcon,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

const TOOLS = [
  { id: 'select', icon: MousePointer2, label: '选择' },
  { id: 'hand', icon: Hand, label: '拖拽' },
  { id: 'text', icon: Type, label: '文本' },
  { id: 'shape', icon: Square, label: '形状' },
  { id: 'arrow', icon: ArrowUpRight, label: '箭头' },
  { id: 'line', icon: Minus, label: '线条' },
  { id: 'image', icon: ImageIcon, label: '图片' },
];

const ACTIONS = [
  { id: 'undo', icon: Undo2, label: '撤销' },
  { id: 'redo', icon: Redo2, label: '重做' },
  { id: 'zoom-in', icon: ZoomIn, label: '放大' },
  { id: 'zoom-out', icon: ZoomOut, label: '缩小' },
];

export default function FloatingToolbar({ activeTool, onToolChange }) {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
      <div className="flex items-center gap-1 px-2 py-1.5 rounded-full backdrop-blur-xl bg-white/70 border border-white/20 shadow-[0_10px_40px_rgba(15,23,42,0.1)]">
        {/* Tools */}
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onToolChange?.(tool.id)}
            title={tool.label}
            className={`w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 ${
              activeTool === tool.id
                ? 'bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)]'
                : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5'
            }`}
          >
            <tool.icon size={16} />
          </button>
        ))}

        {/* Divider */}
        <div className="w-px h-5 bg-black/8 mx-1" />

        {/* Actions */}
        {ACTIONS.map((action) => (
          <button
            key={action.id}
            title={action.label}
            className="w-8 h-8 flex items-center justify-center rounded-full text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5 transition-all duration-200"
          >
            <action.icon size={16} />
          </button>
        ))}
      </div>
    </div>
  );
}

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
import { useLocale } from '@/locales';
import type { TranslationKey } from '@/locales';

interface FloatingToolbarProps {
  activeTool: string;
  onToolChange?: (toolId: string) => void;
}

const TOOLS: { id: string; icon: typeof MousePointer2; labelKey: TranslationKey }[] = [
  { id: 'select', icon: MousePointer2, labelKey: 'toolbar.select' },
  { id: 'hand', icon: Hand, labelKey: 'toolbar.drag' },
  { id: 'text', icon: Type, labelKey: 'toolbar.text' },
  { id: 'shape', icon: Square, labelKey: 'toolbar.shape' },
  { id: 'arrow', icon: ArrowUpRight, labelKey: 'toolbar.arrow' },
  { id: 'line', icon: Minus, labelKey: 'toolbar.line' },
  { id: 'image', icon: ImageIcon, labelKey: 'toolbar.image' },
];

const ACTIONS: { id: string; icon: typeof Undo2; labelKey: TranslationKey }[] = [
  { id: 'undo', icon: Undo2, labelKey: 'toolbar.undo' },
  { id: 'redo', icon: Redo2, labelKey: 'toolbar.redo' },
  { id: 'zoom-in', icon: ZoomIn, labelKey: 'toolbar.zoomIn' },
  { id: 'zoom-out', icon: ZoomOut, labelKey: 'toolbar.zoomOut' },
];

export default function FloatingToolbar({ activeTool, onToolChange }: FloatingToolbarProps) {
  const { t } = useLocale();

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
      <div className="flex items-center gap-1 px-2 py-1.5 rounded-full backdrop-blur-xl bg-[var(--bg-glass)] border border-[var(--border)] shadow-[0_10px_40px_rgba(28,25,23,0.06)]">
        {/* Tools */}
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onToolChange?.(tool.id)}
            title={t(tool.labelKey)}
            className={`w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 ${
              activeTool === tool.id
                ? 'bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)]'
                : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)]'
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
            title={t(action.labelKey)}
            className="w-8 h-8 flex items-center justify-center rounded-full text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] transition-all duration-200"
          >
            <action.icon size={16} />
          </button>
        ))}
      </div>
    </div>
  );
}

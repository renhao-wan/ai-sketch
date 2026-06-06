'use client';

import { Square, Circle, Diamond, Type, ArrowRight, Trash2, Pencil, MousePointer } from 'lucide-react';
import { useLocale } from '@/lib/locales';
import type { DrawioTool } from '@/hooks/useMxGraph';

interface DrawioToolbarProps {
  activeTool: DrawioTool;
  onToolChange: (tool: DrawioTool) => void;
  onDelete: () => void;
  onEditLabel: () => void;
  hasSelection: boolean;
}

const shapeTools: { tool: DrawioTool; icon: typeof Square; labelKey: string }[] = [
  { tool: 'select', icon: MousePointer, labelKey: 'drawio.tool.select' },
  { tool: 'rectangle', icon: Square, labelKey: 'drawio.tool.rectangle' },
  { tool: 'ellipse', icon: Circle, labelKey: 'drawio.tool.ellipse' },
  { tool: 'diamond', icon: Diamond, labelKey: 'drawio.tool.diamond' },
  { tool: 'text', icon: Type, labelKey: 'drawio.tool.text' },
  { tool: 'arrow', icon: ArrowRight, labelKey: 'drawio.tool.arrow' },
];

export default function DrawioToolbar({
  activeTool,
  onToolChange,
  onDelete,
  onEditLabel,
  hasSelection,
}: DrawioToolbarProps) {
  const { t } = useLocale();

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-0.5 bg-[var(--bg-glass)] backdrop-blur-sm rounded-lg border border-[var(--border)] shadow-[var(--shadow-soft)] p-1">
      {/* 图形工具 */}
      {shapeTools.map(({ tool, icon: Icon, labelKey }) => (
        <button
          key={tool}
          onClick={() => onToolChange(tool)}
          className={`p-1.5 rounded transition-colors ${
            activeTool === tool
              ? 'bg-[var(--accent-violet)]/15 text-[var(--accent-violet)]'
              : 'hover:bg-[var(--surface-warm-hover)] text-[var(--muted)] hover:text-[var(--fg)]'
          }`}
          title={t(labelKey)}
        >
          <Icon size={14} />
        </button>
      ))}

      {/* 分隔线 */}
      <div className="w-px h-4 bg-[var(--border)] mx-0.5" />

      {/* 操作按钮 */}
      <button
        onClick={onDelete}
        disabled={!hasSelection}
        className="p-1.5 rounded transition-colors hover:bg-red-500/10 text-[var(--muted)] hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
        title={t('drawio.action.delete')}
      >
        <Trash2 size={14} />
      </button>
      <button
        onClick={onEditLabel}
        disabled={!hasSelection}
        className="p-1.5 rounded transition-colors hover:bg-[var(--surface-warm-hover)] text-[var(--muted)] hover:text-[var(--fg)] disabled:opacity-30 disabled:cursor-not-allowed"
        title={t('drawio.action.editLabel')}
      >
        <Pencil size={14} />
      </button>
    </div>
  );
}

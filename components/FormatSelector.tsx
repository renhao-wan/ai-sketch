'use client';

import type { DiagramFormat } from '@/types/diagram-strategy';

const FORMATS = [
  { key: 'excalidraw' as DiagramFormat, label: 'Excalidraw' },
  { key: 'mermaid' as DiagramFormat, label: 'Mermaid' },
  { key: 'drawio' as DiagramFormat, label: 'Draw.io' },
];

interface FormatSelectorProps {
  value: DiagramFormat;
  onChange: (format: DiagramFormat) => void;
  className?: string;
}

/**
 * 图表格式选择器
 * 显示 Excalidraw / Mermaid / Draw.io 三个选项
 */
export default function FormatSelector({ value, onChange, className = '' }: FormatSelectorProps) {
  return (
    <div className={`segmented-control ${className}`}>
      {FORMATS.map((f) => (
        <button
          key={f.key}
          onClick={() => onChange(f.key)}
          className={`segmented-control-item ${value === f.key ? 'active' : ''}`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

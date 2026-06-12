'use client';

import { useState, useRef, useEffect } from 'react';
import { Zap, Bot, Target } from 'lucide-react';
import Tooltip from '@/components/ui/Tooltip';
import { useLocale } from '@/lib/locales';
import type { GenerationMode } from '@/lib/generation/types';

interface GenerationModeToggleProps {
  value: GenerationMode;
  onChange: (mode: GenerationMode) => void;
  disabled?: boolean;
}

const modes: { value: GenerationMode; icon: typeof Zap; labelKey: string; descKey: string }[] = [
  { value: 'fast', icon: Zap, labelKey: 'generation.mode.fast', descKey: 'generation.mode.fastDesc' },
  { value: 'auto', icon: Bot, labelKey: 'generation.mode.auto', descKey: 'generation.mode.autoDesc' },
  { value: 'quality', icon: Target, labelKey: 'generation.mode.quality', descKey: 'generation.mode.qualityDesc' },
];

export default function GenerationModeToggle({ value, onChange, disabled }: GenerationModeToggleProps) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = modes.find(m => m.value === value) ?? modes[1]; // 兜底到 auto
  const CurrentIcon = current.icon;

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Tooltip content={t(current.descKey as Parameters<typeof t>[0])} side="top">
        <button
          type="button"
          onClick={() => !disabled && setOpen(prev => !prev)}
          disabled={disabled}
          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 disabled:opacity-40 ${
            value !== 'auto'
              ? 'bg-[var(--accent-indigo)]/10 text-[var(--accent-indigo)]'
              : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)]'
          }`}
        >
          <CurrentIcon size={15} />
        </button>
      </Tooltip>

      {open && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 py-1 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] shadow-lg z-50 min-w-[120px]">
          {modes.map(({ value: mode, icon: Icon, labelKey }) => (
            <button
              key={mode}
              type="button"
              onClick={() => { onChange(mode); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                value === mode
                  ? 'text-[var(--accent-indigo)] bg-[var(--accent-indigo)]/5'
                  : 'text-[var(--fg)] hover:bg-[var(--surface-warm-hover)]'
              }`}
            >
              <Icon size={13} />
              <span>{t(labelKey as Parameters<typeof t>[0])}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

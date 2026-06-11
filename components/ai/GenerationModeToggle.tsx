'use client';

import { Zap, Bot, Target } from 'lucide-react';
import Tooltip from '@/components/ui/Tooltip';
import { useLocale } from '@/lib/locales';

export type GenerationMode = 'fast' | 'auto' | 'quality';

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

  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
      {modes.map(({ value: mode, icon: Icon, labelKey, descKey }) => (
        <Tooltip key={mode} content={t(descKey as Parameters<typeof t>[0])} side="top">
          <button
            type="button"
            onClick={() => onChange(mode)}
            disabled={disabled}
            className={`
              flex items-center justify-center w-7 h-7 rounded-md transition-all duration-200
              ${value === mode
                ? 'bg-[var(--accent-indigo)] text-white shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)]'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <Icon size={14} />
          </button>
        </Tooltip>
      ))}
    </div>
  );
}

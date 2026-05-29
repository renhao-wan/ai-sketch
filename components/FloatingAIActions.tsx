'use client';

import {
  Sparkles,
  LayoutGrid,
  Palette,
  HelpCircle,
  Plus,
} from 'lucide-react';
import { useLocale } from '@/locales';
import type { AIActionId } from '@/types';
import type { TranslationKey } from '@/locales';

interface FloatingAIActionsProps {
  onAction?: (actionId: AIActionId) => void;
}

const ACTIONS: { id: AIActionId; icon: typeof Sparkles; labelKey: TranslationKey; color: string }[] = [
  { id: 'optimize', icon: Sparkles, labelKey: 'aiAction.optimize', color: 'from-[var(--accent-indigo)] to-[var(--accent-violet)]' },
  { id: 'layout', icon: LayoutGrid, labelKey: 'aiAction.layout', color: 'from-[var(--accent-violet)] to-purple-500' },
  { id: 'beautify', icon: Palette, labelKey: 'aiAction.beautify', color: 'from-[var(--accent-cyan)] to-teal-500' },
  { id: 'explain', icon: HelpCircle, labelKey: 'aiAction.explain', color: 'from-amber-500 to-orange-500' },
  { id: 'generate', icon: Plus, labelKey: 'aiAction.generate', color: 'from-emerald-500 to-green-500' },
];

export default function FloatingAIActions({ onAction }: FloatingAIActionsProps) {
  const { t } = useLocale();

  return (
    <div className="absolute right-4 top-1/2 -translate-y-1/2 z-30 animate-fade-in" style={{ animationDelay: '200ms' }}>
      <div className="flex flex-col gap-2">
        {ACTIONS.map((action) => (
          <button
            key={action.id}
            onClick={() => onAction?.(action.id)}
            title={t(action.labelKey)}
            className="group relative w-10 h-10 flex items-center justify-center rounded-2xl backdrop-blur-xl bg-[var(--bg-glass)] border border-[var(--border)] shadow-[0_4px_20px_rgba(28,25,23,0.05)] hover:shadow-[0_0_30px_rgba(124,58,237,0.12)] hover:bg-[var(--card)] transition-all duration-300 hover:-translate-y-px hover-lift"
          >
            <action.icon size={17} className="text-[var(--muted)] group-hover:text-[var(--fg)] transition-colors duration-200" />
            {/* Tooltip */}
            <div className="absolute right-full mr-3 px-3 py-1.5 rounded-xl bg-[var(--primary)] text-white text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 shadow-[0_4px_16px_rgba(28,25,23,0.12)]">
              {t(action.labelKey)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

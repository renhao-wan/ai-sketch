'use client';

import {
  LayoutGrid,
  Palette,
  Minimize2,
  HelpCircle,
  Loader2,
} from 'lucide-react';
import { useLocale } from '@/lib/locales';
import Tooltip from '@/components/ui/Tooltip';
import type { AIActionId } from '@/lib/types';
import type { TranslationKey } from '@/lib/locales';

interface FloatingAIActionsProps {
  onAction?: (actionId: AIActionId) => void;
  loadingAction?: AIActionId | null;
  disabled?: boolean;
}

const ACTIONS: { id: AIActionId; icon: typeof LayoutGrid; labelKey: TranslationKey; color: string }[] = [
  { id: 'layout', icon: LayoutGrid, labelKey: 'aiAction.layout', color: 'from-[var(--accent-indigo)] to-[var(--accent-violet)]' },
  { id: 'beautify', icon: Palette, labelKey: 'aiAction.beautify', color: 'from-[var(--accent-violet)] to-purple-500' },
  { id: 'simplify', icon: Minimize2, labelKey: 'aiAction.simplify', color: 'from-[var(--accent-cyan)] to-teal-500' },
  { id: 'explain', icon: HelpCircle, labelKey: 'aiAction.explain', color: 'from-amber-500 to-orange-500' },
];

export default function FloatingAIActions({ onAction, loadingAction, disabled }: FloatingAIActionsProps) {
  const { t } = useLocale();

  return (
    <div className="absolute right-4 top-1/2 -translate-y-1/2 z-30">
      <div className="flex flex-col gap-2">
        {ACTIONS.map((action) => {
          const isLoading = loadingAction === action.id;
          const Icon = isLoading ? Loader2 : action.icon;
          return (
            <Tooltip key={action.id} content={isLoading ? t('aiAction.loading') : t(action.labelKey)} side="left">
              <button
                onClick={() => onAction?.(action.id)}
                disabled={disabled || !!loadingAction}
                className={`group relative w-10 h-10 flex items-center justify-center rounded-2xl backdrop-blur-xl bg-[var(--bg-glass)] border border-[var(--border)] shadow-[0_4px_20px_rgba(28,25,23,0.05)] transition-all duration-300 ${
                  isLoading
                    ? 'animate-pulse cursor-wait'
                    : disabled || loadingAction
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:shadow-[0_0_30px_rgba(124,58,237,0.12)] hover:bg-[var(--card)] hover:-translate-y-px hover-lift'
                }`}
              >
                <Icon size={17} className={`text-[var(--muted)] group-hover:text-[var(--fg)] transition-colors duration-200 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

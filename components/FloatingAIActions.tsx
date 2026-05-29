'use client';

import {
  Sparkles,
  LayoutGrid,
  Palette,
  HelpCircle,
  Plus,
} from 'lucide-react';
import type { AIActionId } from '@/types';

interface FloatingAIActionsProps {
  onAction?: (actionId: AIActionId) => void;
}

const ACTIONS = [
  { id: 'optimize' as const, icon: Sparkles, label: 'AI 优化', color: 'from-[var(--accent-indigo)] to-[var(--accent-violet)]' },
  { id: 'layout' as const, icon: LayoutGrid, label: '自动布局', color: 'from-[var(--accent-violet)] to-purple-500' },
  { id: 'beautify' as const, icon: Palette, label: '美化图表', color: 'from-[var(--accent-cyan)] to-teal-500' },
  { id: 'explain' as const, icon: HelpCircle, label: '解释图表', color: 'from-amber-500 to-orange-500' },
  { id: 'generate' as const, icon: Plus, label: '生成节点', color: 'from-emerald-500 to-green-500' },
];

export default function FloatingAIActions({ onAction }: FloatingAIActionsProps) {
  return (
    <div className="absolute right-4 top-1/2 -translate-y-1/2 z-30 animate-fade-in" style={{ animationDelay: '200ms' }}>
      <div className="flex flex-col gap-2">
        {ACTIONS.map((action) => (
          <button
            key={action.id}
            onClick={() => onAction?.(action.id)}
            title={action.label}
            className="group relative w-10 h-10 flex items-center justify-center rounded-2xl backdrop-blur-xl bg-[var(--bg-glass)] border border-[var(--border)] shadow-[0_4px_20px_rgba(28,25,23,0.05)] hover:shadow-[0_0_30px_rgba(124,58,237,0.12)] hover:bg-[var(--card)] transition-all duration-300 hover:-translate-y-px hover-lift"
          >
            <action.icon size={17} className="text-[var(--muted)] group-hover:text-[var(--fg)] transition-colors duration-200" />
            {/* Tooltip */}
            <div className="absolute right-full mr-3 px-3 py-1.5 rounded-xl bg-[var(--primary)] text-white text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 shadow-[0_4px_16px_rgba(28,25,23,0.12)]">
              {action.label}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

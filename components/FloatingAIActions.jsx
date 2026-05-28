'use client';

import {
  Sparkles,
  LayoutGrid,
  Palette,
  HelpCircle,
  Plus,
} from 'lucide-react';

const ACTIONS = [
  { id: 'optimize', icon: Sparkles, label: 'AI 优化', color: 'from-[var(--accent-indigo)] to-[var(--accent-violet)]' },
  { id: 'layout', icon: LayoutGrid, label: '自动布局', color: 'from-[var(--accent-violet)] to-purple-500' },
  { id: 'beautify', icon: Palette, label: '美化图表', color: 'from-[var(--accent-cyan)] to-teal-500' },
  { id: 'explain', icon: HelpCircle, label: '解释图表', color: 'from-amber-500 to-orange-500' },
  { id: 'generate', icon: Plus, label: '生成节点', color: 'from-emerald-500 to-green-500' },
];

export default function FloatingAIActions({ onAction }) {
  return (
    <div className="absolute right-4 top-1/2 -translate-y-1/2 z-30">
      <div className="flex flex-col gap-2">
        {ACTIONS.map((action) => (
          <button
            key={action.id}
            onClick={() => onAction?.(action.id)}
            title={action.label}
            className="group relative w-10 h-10 flex items-center justify-center rounded-2xl backdrop-blur-xl bg-white/70 border border-white/20 shadow-[0_4px_20px_rgba(15,23,42,0.06)] hover:shadow-[0_0_30px_rgba(99,102,241,0.15)] transition-all duration-300 hover:-translate-y-px"
          >
            <action.icon size={17} className="text-[var(--muted)] group-hover:text-[var(--fg)] transition-colors duration-200" />
            {/* Tooltip */}
            <div className="absolute right-full mr-3 px-2.5 py-1 rounded-lg bg-[var(--primary)] text-white text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200">
              {action.label}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

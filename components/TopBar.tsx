'use client';

import {
  Settings,
  History,
  Download,
} from 'lucide-react';

interface AppIconProps {
  size?: number;
}

/** App icon — indigo rounded-square with white pen nib + sparkle */
function AppIcon({ size = 28 }: AppIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill="url(#icon-bg)" />
      <defs>
        <linearGradient id="icon-bg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366F1" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      {/* Pen nib */}
      <path
        d="M20.5 8.5L24 12L13 23H9.5V19.5L20.5 8.5Z"
        fill="white"
        fillOpacity="0.95"
      />
      {/* Divider line on nib */}
      <path
        d="M18.5 11L22 14.5"
        stroke="#6366F1"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.4"
      />
      {/* Sparkle */}
      <circle cx="23" cy="8.5" r="1.5" fill="white" fillOpacity="0.9" />
      <path d="M23 6V11" stroke="white" strokeWidth="0.7" strokeLinecap="round" opacity="0.6" />
      <path d="M20.5 8.5H25.5" stroke="white" strokeWidth="0.7" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

interface TopBarProps {
  onOpenConfig: () => void;
  onOpenHistory: () => void;
  onExport: () => void;
}

export default function TopBar({ onOpenConfig, onOpenHistory, onExport }: TopBarProps) {
  return (
    <header className="h-12 flex items-center justify-between px-4 backdrop-blur-xl bg-white/80 border-b border-black/[0.08] flex-shrink-0 select-none">
      {/* Left — App Identity */}
      <div className="flex items-center gap-2.5 min-w-[200px]">
        <AppIcon size={28} />
        <span className="text-[13px] font-semibold tracking-tight text-[var(--fg)]">
          AI Sketch
        </span>
      </div>

      {/* Center — Menu Bar */}
      <nav className="flex items-center gap-0.5">
        {['文件', '编辑', '视图', '帮助'].map((item) => (
          <button
            key={item}
            className="px-3.5 py-1.5 text-[12px] font-medium text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/[0.05] rounded-lg transition-colors duration-150"
          >
            {item}
          </button>
        ))}
      </nav>

      {/* Right — Actions */}
      <div className="flex items-center gap-1 min-w-[200px] justify-end">
        <button
          onClick={onOpenHistory}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/[0.05] transition-colors duration-150"
          title="历史记录"
        >
          <History size={15} />
        </button>
        <button
          onClick={onExport}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/[0.05] transition-colors duration-150"
          title="导出"
        >
          <Download size={15} />
        </button>
        <div className="w-px h-4 bg-black/[0.08] mx-1" />
        <button
          onClick={onOpenConfig}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/[0.05] transition-colors duration-150"
          title="设置"
        >
          <Settings size={15} />
        </button>
      </div>
    </header>
  );
}

export { AppIcon };

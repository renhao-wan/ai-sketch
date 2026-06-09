'use client';

import { X } from 'lucide-react';

interface TagBadgeProps {
  name: string;
  color: string;
  size?: 'sm' | 'md';
  variant?: 'pill' | 'dot';
  onRemove?: () => void;
  onClick?: () => void;
  selected?: boolean;
  className?: string;
}

/** 标签胶囊组件 */
export default function TagBadge({
  name,
  color,
  size = 'sm',
  variant = 'pill',
  onRemove,
  onClick,
  selected = false,
  className = '',
}: TagBadgeProps) {
  // dot 模式：仅显示彩色圆点，hover 显示名称
  if (variant === 'dot') {
    return (
      <span
        className={`relative group/dot inline-flex items-center ${onClick ? 'cursor-pointer' : ''} ${className}`}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      >
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        {/* hover 提示 */}
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 text-[10px] text-[var(--fg)] bg-[var(--surface-warm)] border border-[var(--border)] rounded whitespace-nowrap opacity-0 group-hover/dot:opacity-100 transition-opacity pointer-events-none shadow-sm">
          {name}
        </span>
      </span>
    );
  }

  // pill 模式
  const sizeClasses = size === 'sm'
    ? 'px-1.5 py-0.5 text-[10px]'
    : 'px-2 py-1 text-xs';

  const baseClasses = `
    inline-flex items-center gap-1 rounded-full font-medium transition-all duration-200
    ${sizeClasses}
    ${onClick ? 'cursor-pointer' : ''}
    ${selected
      ? 'ring-2 ring-offset-1'
      : 'opacity-90 hover:opacity-100'
    }
    ${className}
  `;

  const style: React.CSSProperties = {
    backgroundColor: `${color}20`,
    color: color,
    borderColor: `${color}40`,
    ...(selected ? { '--tw-ring-color': color } as React.CSSProperties : {}),
  };

  return (
    <span
      className={baseClasses}
      style={style}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
    >
      <span className="truncate max-w-[80px]">{name}</span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`${name} 标签`}
          className="ml-0.5 hover:opacity-70 transition-opacity"
        >
          <X size={size === 'sm' ? 10 : 12} />
        </button>
      )}
    </span>
  );
}

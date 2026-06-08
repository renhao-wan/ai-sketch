'use client';

import { X } from 'lucide-react';

interface TagBadgeProps {
  name: string;
  color: string;
  size?: 'sm' | 'md';
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
  onRemove,
  onClick,
  selected = false,
  className = '',
}: TagBadgeProps) {
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

  const style = {
    backgroundColor: `${color}20`,
    color: color,
    borderColor: `${color}40`,
    ...(selected ? { ringColor: color } : {}),
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
      <span className="truncate max-w-[100px]">{name}</span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 hover:opacity-70 transition-opacity"
        >
          <X size={size === 'sm' ? 10 : 12} />
        </button>
      )}
    </span>
  );
}

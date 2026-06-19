'use client';

interface ToggleSwitchProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  size?: 'sm' | 'md';
  disabled?: boolean;
}

export default function ToggleSwitch({ enabled, onChange, size = 'md', disabled = false }: ToggleSwitchProps) {
  const sizeClasses = {
    sm: 'w-8 h-4',
    md: 'w-10 h-5',
  };

  const dotSizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
  };

  const translateClasses = {
    sm: enabled ? 'translate-x-4' : 'translate-x-0.5',
    md: enabled ? 'translate-x-5' : 'translate-x-0.5',
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={`
        relative inline-flex items-center rounded-full transition-all duration-300 ease-in-out
        ${sizeClasses[size]}
        ${enabled
          ? 'bg-[var(--accent-indigo)]'
          : 'bg-[var(--surface-warm-hover)] border border-[var(--border)]'
        }
        ${disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'cursor-pointer hover:shadow-md'
        }
        focus:outline-none focus:ring-2 focus:ring-[var(--accent-indigo)]/20 focus:ring-offset-2 focus:ring-offset-[var(--bg)]
      `}
    >
      <span
        className={`
          inline-block rounded-full bg-white shadow-sm transition-transform duration-300 ease-in-out
          ${dotSizeClasses[size]}
          ${translateClasses[size]}
        `}
      />
    </button>
  );
}

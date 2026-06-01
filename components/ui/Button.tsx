import { type ReactNode, type ButtonHTMLAttributes } from 'react';
import Spinner from './Spinner';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  onClick,
  type = 'button',
  className = '',
}: ButtonProps) {
  const baseClasses = 'font-medium transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-indigo)]/30 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-px active:scale-[0.98]';

  const variants: Record<string, string> = {
    primary: 'bg-[var(--btn-primary)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover)] rounded-xl',
    secondary: 'bg-[var(--surface-warm-hover)] text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] border border-[var(--surface-warm-hover)] rounded-xl',
    danger: 'bg-red-600 text-white hover:bg-red-700 rounded-xl',
    ghost: 'bg-transparent text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--surface-warm-hover)] rounded-xl',
    glass: 'bg-[var(--bg-glass)] backdrop-blur-xl border border-[var(--border)] text-[var(--fg)] hover:bg-[var(--card)] rounded-xl',
  };

  const sizes: Record<string, string> = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className} inline-flex items-center justify-center gap-2`}
    >
      {loading && <Spinner size={size === 'sm' ? 'sm' : 'md'} />}
      {children}
    </button>
  );
}

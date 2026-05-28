import Spinner from './Spinner';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  onClick,
  type = 'button',
  className = '',
}) {
  const baseClasses = 'font-medium transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-indigo)]/30 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-px active:scale-[0.98]';

  const variants = {
    primary: 'bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90 rounded-xl',
    secondary: 'bg-black/5 text-[var(--fg)] hover:bg-black/8 border border-black/5 rounded-xl',
    danger: 'bg-red-600 text-white hover:bg-red-700 rounded-xl',
    ghost: 'bg-transparent text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5 rounded-xl',
    glass: 'bg-white/60 backdrop-blur-xl border border-white/10 text-[var(--fg)] hover:bg-white/80 rounded-xl',
  };

  const sizes = {
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

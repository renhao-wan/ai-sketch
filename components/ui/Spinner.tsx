interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'white' | 'gray' | 'primary';
}

export default function Spinner({ size = 'md', color = 'white' }: SpinnerProps) {
  const sizeClasses: Record<string, string> = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
    xl: 'w-8 h-8',
  };

  const colorClasses: Record<string, string> = {
    white: 'border-white/30 border-t-white',
    gray: 'border-[var(--muted)]/20 border-t-[var(--muted)]',
    primary: 'border-[var(--accent-indigo)]/20 border-t-[var(--accent-indigo)]',
  };

  return (
    <div
      className={`${sizeClasses[size]} ${colorClasses[color]} border-2 rounded-full animate-spin`}
    />
  );
}

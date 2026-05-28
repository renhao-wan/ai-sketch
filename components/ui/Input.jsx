export default function Input({
  type = 'text',
  value,
  onChange,
  placeholder,
  disabled = false,
  className = '',
  ...props
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className={`w-full px-4 py-2.5 text-sm bg-black/4 border border-black/5 rounded-xl text-[var(--fg)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent-indigo)]/30 focus:border-[var(--accent-indigo)]/30 disabled:bg-black/2 disabled:cursor-not-allowed transition-all duration-200 ${className}`}
      {...props}
    />
  );
}

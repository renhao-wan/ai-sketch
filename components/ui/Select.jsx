export default function Select({
  value,
  onChange,
  options = [],
  disabled = false,
  className = '',
  ...props
}) {
  return (
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={`w-full px-4 py-2.5 text-sm bg-black/4 border border-black/5 rounded-xl text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-indigo)]/30 disabled:bg-black/2 disabled:cursor-not-allowed transition-all duration-200 appearance-none cursor-pointer ${className}`}
      {...props}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

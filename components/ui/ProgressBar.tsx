interface ProgressProps {
  value: number; // 0-100
  className?: string;
  tone?: 'accent' | 'success';
}

export function ProgressBar({ value, className = '', tone = 'accent' }: ProgressProps) {
  const barColor =
    tone === 'success'
      ? 'bg-gradient-to-r from-emerald-600 to-emerald-400'
      : 'bg-gradient-to-r from-[var(--accent-deep)] to-[var(--accent-strong)]';
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-[var(--surface-strong)] ${className}`}>
      <div
        className={`h-full ${barColor} transition-all duration-300`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

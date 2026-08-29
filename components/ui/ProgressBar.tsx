interface ProgressProps {
  value: number; // 0-100
  className?: string;
  tone?: 'accent' | 'success';
}

export function ProgressBar({ value, className = '', tone = 'accent' }: ProgressProps) {
  const barColor =
    tone === 'success'
      ? 'bg-[var(--emerald)]'
      : 'bg-[var(--accent)]';
  return (
    <div className={`h-3 overflow-hidden rounded-full border-2 border-[var(--text)] bg-[var(--bg)] ${className}`}>
      <div
        className={`h-full ${barColor} transition-all duration-300`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

'use client';

interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export function Progress({ value, max = 100, className = '', size = 'md', showLabel }: ProgressProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={`space-y-1 ${className}`}>
      {showLabel && (
        <div className="flex justify-between text-xs text-[var(--text-50)]">
          <span>{Math.round(pct)}%</span>
        </div>
      )}
      <div className={`rounded-full bg-[var(--surface-strong)] overflow-hidden ${size === 'sm' ? 'h-1' : 'h-2'}`}>
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)] transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
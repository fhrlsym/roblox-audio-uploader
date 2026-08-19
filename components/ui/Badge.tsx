import type { ReactNode } from 'react';

type Tone = 'default' | 'accent' | 'success' | 'danger' | 'warning';

const TONES: Record<Tone, string> = {
  default: 'border-[var(--line)] bg-[var(--surface-soft)] text-[var(--text-50)]',
  accent: 'border-[var(--accent-30)] bg-[var(--accent-10)] text-[var(--accent-strong)]',
  success: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
  danger: 'border-rose-400/25 bg-rose-400/10 text-rose-300',
  warning: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
};

interface BadgeProps {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  icon?: ReactNode;
}

export function Badge({ children, tone = 'default', className = '', icon }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${TONES[tone]} ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}

interface PillProps {
  children: ReactNode;
  className?: string;
}

/** Non-interactive flat pill (used for feature tags / chips). */
export function Pill({ children, className = '' }: PillProps) {
  return (
    <span className={`inline-flex items-center rounded-md bg-[var(--accent-15)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--accent-strong)] ${className}`}>
      {children}
    </span>
  );
}

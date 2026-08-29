import type { ReactNode } from 'react';

type Tone = 'default' | 'accent' | 'success' | 'danger' | 'warning';

const TONES: Record<Tone, string> = {
  default: 'border-2 border-[var(--text)] bg-[var(--bg)] text-[var(--text)]',
  accent: 'border-2 border-[var(--text)] bg-[var(--accent)] text-[var(--on-accent)]',
  success: 'border-2 border-[var(--text)] bg-[var(--emerald)] text-white',
  danger: 'border-2 border-[var(--text)] bg-[var(--danger)] text-white',
  warning: 'border-2 border-[var(--text)] bg-amber-400 text-black',
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
      className={`inline-flex items-center gap-1.5 rounded-full border-2 border-[var(--text)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${TONES[tone]} ${className}`}
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
    <span className={`inline-flex items-center border-2 border-[var(--text)] bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--on-accent)] ${className}`}>
      {children}
    </span>
  );
}

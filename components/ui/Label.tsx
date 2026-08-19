import type { ReactNode } from 'react';

interface LabelProps {
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}

export function Label({ children, htmlFor, className = '' }: LabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={`text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-45)] ${className}`}
    >
      {children}
    </label>
  );
}

interface SectionTitleProps {
  step?: string;
  title: string;
  actions?: ReactNode;
}

/** Panel header: e.g. "1. Input Audio" with optional actions. */
export function SectionTitle({ step, title, actions }: SectionTitleProps) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold tracking-tight text-[var(--text)]">
        {step ? `${step}. ${title}` : title}
      </h2>
      {actions}
    </div>
  );
}

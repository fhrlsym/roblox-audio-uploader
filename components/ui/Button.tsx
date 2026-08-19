'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] text-[var(--on-accent)] font-semibold transition duration-150 ease-out hover:brightness-[1.06] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 shadow-sm',
  secondary:
    'inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--accent-25)] bg-[var(--accent-10)] text-[var(--accent-strong)] font-semibold transition duration-150 ease-out hover:bg-[var(--accent-15)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100',
  ghost:
    'inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--text-80)] font-medium transition duration-150 ease-out hover:border-[var(--accent-30)] hover:text-[var(--text)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100',
  danger:
    'inline-flex items-center justify-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--danger)_28%,transparent)] bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-[var(--danger)] font-medium transition duration-150 ease-out hover:bg-[color-mix(in_srgb,var(--danger)_20%,transparent)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40',
};

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-sm',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  loadingText?: string;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, loadingText, icon, children, className, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`${VARIANTS[variant]} ${SIZES[size]} ${className || ''}`}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {loadingText || children}
          </>
        ) : (
          <>
            {icon}
            {children}
          </>
        )}
      </button>
    );
  }
);
Button.displayName = 'Button';

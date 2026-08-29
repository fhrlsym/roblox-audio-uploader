'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'inline-flex items-center justify-center gap-2 border-2 border-[var(--text)] shadow-[3px_3px_0_0_var(--text)] rounded-lg bg-[var(--accent)] text-[var(--on-accent)] font-bold uppercase tracking-wide transition duration-150 ease-out hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[5px_5px_0_0_var(--text)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_0_var(--text)] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[3px_3px_0_0_var(--text)]',
  secondary:
    'inline-flex items-center justify-center gap-2 border-2 border-[var(--text)] shadow-[3px_3px_0_0_var(--text)] rounded-lg bg-[var(--bg)] text-[var(--text)] font-bold uppercase tracking-wide transition duration-150 ease-out hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[5px_5px_0_0_var(--text)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_0_var(--text)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[3px_3px_0_0_var(--text)]',
  ghost:
    'inline-flex items-center justify-center gap-2 border-2 border-[var(--text)] shadow-[3px_3px_0_0_var(--text)] rounded-lg bg-[var(--panel)] text-[var(--text)] font-bold uppercase tracking-wide transition duration-150 ease-out hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[5px_5px_0_0_var(--text)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_0_var(--text)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[3px_3px_0_0_var(--text)]',
  danger:
    'inline-flex items-center justify-center gap-2 border-2 border-[var(--text)] shadow-[3px_3px_0_0_var(--text)] rounded-lg bg-[var(--danger)] text-white font-bold uppercase tracking-wide transition duration-150 ease-out hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[5px_5px_0_0_var(--text)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_0_var(--text)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[3px_3px_0_0_var(--text)]',
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

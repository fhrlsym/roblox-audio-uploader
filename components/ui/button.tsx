'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';

const variants = {
  primary:
    'bg-[var(--accent)] text-[var(--on-accent)] shadow-sm hover:brightness-[1.06] active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100',
  secondary:
    'border border-[var(--accent-25)] bg-[var(--accent-10)] text-[var(--accent-strong)] hover:bg-[var(--accent-15)] active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100',
  ghost:
    'border border-[var(--line)] bg-[var(--surface)] text-[var(--text-80)] hover:border-[var(--accent-30)] hover:text-[var(--text)] active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100',
  danger:
    'border border-[color-mix(in_srgb,var(--danger)_28%,transparent)] bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_20%,transparent)] active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, className = '', children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition duration-150 ease-out ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  )
);
Button.displayName = 'Button';
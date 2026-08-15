'use client';

import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => (
    <div className="space-y-1.5">
      {label && (
        <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-45)]">
          {label}
        </label>
      )}
      <input
        ref={ref}
        className={`w-full bg-[var(--surface-focus)] text-[var(--text)] rounded-xl px-4 py-3 border text-sm outline-none transition duration-150 ease-out focus:border-[var(--accent-40)] focus:ring-2 focus:ring-[var(--accent-20)] placeholder:text-[var(--text-35)] disabled:opacity-40 ${
          error ? 'border-[var(--danger)]' : 'border-[var(--line)]'
        } ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-[var(--danger)] mt-1">{error}</p>}
    </div>
  )
);
Input.displayName = 'Input';
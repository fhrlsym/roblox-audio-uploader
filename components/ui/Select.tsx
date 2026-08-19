'use client';

import { forwardRef, type SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  children: React.ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, hint, children, className = '', ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-45)]">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={`w-full bg-[var(--surface-focus)] text-[var(--text)] rounded-xl px-4 py-2.5 border border-[var(--line)] text-sm outline-none transition duration-150 ease-out focus:border-[var(--accent-40)] focus:ring-2 focus:ring-[var(--accent-20)] ${className}`}
          {...props}
        >
          {children}
        </select>
        {hint && <p className="text-[10px] text-[var(--text-40)] leading-relaxed">{hint}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';

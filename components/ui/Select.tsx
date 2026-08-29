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
          className={`w-full bg-[var(--bg)] text-[var(--text)] rounded-lg px-4 py-2.5 border-2 border-[var(--text)] text-sm font-semibold outline-none transition-colors duration-150 focus:border-[var(--accent)] ${className}`}
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

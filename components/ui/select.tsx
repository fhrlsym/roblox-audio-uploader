'use client';

import { SelectHTMLAttributes, forwardRef } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, className = '', ...props }, ref) => (
    <div className="space-y-1.5">
      {label && (
        <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-45)]">
          {label}
        </label>
      )}
      <select
        ref={ref}
        className={`w-full bg-[var(--surface-focus)] text-[var(--text)] rounded-xl px-4 py-3 border border-[var(--line)] text-sm outline-none transition duration-150 ease-out focus:border-[var(--accent-40)] focus:ring-2 focus:ring-[var(--accent-20)] disabled:opacity-40 appearance-none cursor-pointer ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
);
Select.displayName = 'Select';
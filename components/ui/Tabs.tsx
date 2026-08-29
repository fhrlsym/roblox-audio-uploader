'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
  icon?: ReactNode;
  badge?: number;
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
}

export function Tabs<T extends string>({ items, active, onChange, className = '' }: TabsProps<T>) {
  const [open, setOpen] = useState(false);

  const activeItem = items.find((i) => i.id === active);

  return (
    <>
      {/* Desktop inline tabs */}
      <div className={`hidden items-center gap-1 rounded-lg border-2 border-[var(--text)] bg-[var(--bg)] p-1 shadow-[3px_3px_0_0_var(--text)] sm:flex ${className}`}>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
              active === item.id
                ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                : 'text-[var(--text-60)] hover:bg-[var(--surface)] hover:text-[var(--text)]'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
            {typeof item.badge === 'number' && item.badge > 0 && (
              <span
                className={`rounded-full border-2 border-[var(--text)] px-1.5 py-0.5 text-[9px] font-bold leading-none ${
                  active === item.id ? 'bg-[var(--bg)] text-[var(--text)]' : 'bg-[var(--accent)] text-[var(--on-accent)]'
                }`}
              >
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Mobile dropdown */}
      <div className="relative sm:hidden">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex w-full items-center justify-between rounded-lg border-2 border-[var(--text)] bg-[var(--bg)] px-3 py-2 text-xs font-bold uppercase tracking-wide text-[var(--text)] shadow-[3px_3px_0_0_var(--text)]"
        >
          <span className="flex items-center gap-1.5">
            {activeItem?.icon}
            {activeItem?.label}
          </span>
          <ChevronDown className={`h-4 w-4 text-[var(--text)] transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute inset-x-0 top-full z-20 mt-1 space-y-1 rounded-lg border-2 border-[var(--text)] bg-[var(--panel)] p-1.5 shadow-[4px_4px_0_0_var(--text)]">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onChange(item.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-bold uppercase tracking-wide transition ${
                  active === item.id ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'text-[var(--text-60)] hover:bg-[var(--surface)]'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

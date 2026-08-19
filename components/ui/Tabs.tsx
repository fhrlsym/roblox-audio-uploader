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
      <div className={`hidden items-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface-50)] p-1 sm:flex ${className}`}>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              active === item.id
                ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-sm'
                : 'text-[var(--text-60)] hover:text-[var(--text)]'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
            {typeof item.badge === 'number' && item.badge > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none ${
                  active === item.id ? 'bg-black/20 text-[var(--on-accent)]' : 'bg-[var(--surface-strong)] text-[var(--text-40)]'
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
          className="flex w-full items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface-50)] px-3 py-2 text-xs font-semibold text-[var(--text)]"
        >
          <span className="flex items-center gap-1.5">
            {activeItem?.icon}
            {activeItem?.label}
          </span>
          <ChevronDown className={`h-4 w-4 text-[var(--text-45)] transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute inset-x-0 top-full z-20 mt-1 space-y-1 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1.5 shadow-xl">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onChange(item.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  active === item.id ? 'bg-[var(--accent-10)] text-[var(--text)]' : 'text-[var(--text-60)]'
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

'use client';

import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface CollapsibleProps {
  trigger: ReactNode;
  count?: number;
  countLabel?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  triggerIcon?: ReactNode;
}

export function Collapsible({ trigger, count, countLabel, children, defaultOpen = false, triggerIcon }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center">
        <button
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-50)] px-4 py-2.5 text-xs font-semibold text-[var(--text-80)] transition hover:border-[var(--accent-30)] hover:text-[var(--accent-strong)] hover:bg-[var(--surface)]"
        >
          {triggerIcon}
          <span>{trigger}</span>
          {typeof count === 'number' && count > 0 && (
            <span className="rounded-full bg-[var(--accent-15)] px-2 py-0.5 text-[10px] font-bold text-[var(--accent-strong)]">
              {count}
            </span>
          )}
          {countLabel && <span className="text-[var(--text-45)]">{countLabel}</span>}
          <ChevronDown
            className={`h-4 w-4 text-[var(--text-45)] transition-transform duration-300 ${open ? 'rotate-180 text-[var(--accent)]' : ''}`}
          />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

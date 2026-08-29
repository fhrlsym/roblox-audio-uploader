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
          className="brutal-btn-flat inline-flex items-center gap-2"
        >
          {triggerIcon}
          <span>{trigger}</span>
          {typeof count === 'number' && count > 0 && (
            <span className="rounded-full border-2 border-[var(--text)] bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold text-[var(--on-accent)]">
              {count}
            </span>
          )}
          {countLabel && <span className="text-[var(--text-50)]">{countLabel}</span>}
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
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

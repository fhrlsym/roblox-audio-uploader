'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  preventClose?: boolean;
}

const SIZES: Record<string, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
};

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  size = 'md',
  preventClose = false,
}: ModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastActiveRef = useRef<HTMLElement | null>(null);

  const handleClose = useCallback(() => {
    if (!preventClose) onClose();
  }, [preventClose, onClose]);

  // Focus trap + restore focus
  useEffect(() => {
    if (!isOpen) return;
    lastActiveRef.current = document.activeElement as HTMLElement | null;
    const timer = setTimeout(() => {
      const autoFocusEl = containerRef.current?.querySelector<HTMLElement>('[data-autofocus]');
      (autoFocusEl ?? closeRef.current)?.focus();
    }, 50);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      lastActiveRef.current?.focus?.();
    };
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={handleClose}
    >
      <div
        ref={containerRef}
        className={`modal-enter flex max-h-[92vh] w-full ${SIZES[size]} flex-col rounded-xl border-2 border-[var(--text)] bg-[var(--panel)] shadow-[6px_6px_0_0_var(--text)]`}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || icon) && (
          <div className="flex items-center justify-between gap-3 border-b-2 border-[var(--text)] p-5">
            <div className="flex items-center gap-3">
              {icon}
              <div>
                {title && <h3 className="text-lg font-extrabold uppercase tracking-tight text-[var(--text)]">{title}</h3>}
                {subtitle && <p className="mt-0.5 text-xs font-semibold text-[var(--text-50)]">{subtitle}</p>}
              </div>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={handleClose}
              aria-label="Tutup"
              className="border-2 border-[var(--text)] bg-[var(--bg)] p-2 text-[var(--text)] transition hover:bg-[var(--accent)] hover:text-[var(--on-accent)] active:translate-y-[1px]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto p-5">{children}</div>

        {footer && (
          <div className="shrink-0 border-t-2 border-[var(--text)] bg-[var(--bg)] p-4 sm:p-5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

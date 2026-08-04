'use client';

import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import { CheckCircle2, Info, XCircle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const icons: Record<ToastType, ReactNode> = {
    success: <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />,
    error: <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />,
    info: <Info className="w-4 h-4 text-[var(--accent-soft)] flex-shrink-0" />,
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[200] flex w-80 max-w-[calc(100vw-3rem)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="toast-enter pointer-events-auto flex items-start gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 shadow-2xl"
          >
            {icons[t.type]}
            <p className="text-sm text-[var(--text-80)]">{t.message}</p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

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
const TOAST_DURATION = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_DURATION);
  }, []);

  const icons: Record<ToastType, ReactNode> = {
    success: <CheckCircle2 className="w-4 h-4 text-[var(--emerald)] flex-shrink-0" />,
    error: <XCircle className="w-4 h-4 text-[var(--danger)] flex-shrink-0" />,
    info: <Info className="w-4 h-4 text-[var(--accent)] flex-shrink-0" />,
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[200] flex w-80 max-w-[calc(100vw-3rem)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="toast-enter pointer-events-auto flex flex-col items-start gap-2 rounded-lg border-2 border-[var(--text)] bg-[var(--panel)] shadow-[4px_4px_0_0_var(--text)] overflow-hidden"
          >
            <div className="flex items-start gap-2.5 px-4 pt-3 pb-2">
              {icons[t.type]}
              <p className="text-sm font-bold text-[var(--text-90)]">{t.message}</p>
            </div>
            {/* Auto-dismiss progress bar */}
            <div className="w-full h-1 bg-[var(--bg)]">
              <div
                className={`h-full toast-progress ${
                  t.type === 'success' ? 'bg-[var(--emerald)]' : t.type === 'error' ? 'bg-[var(--danger)]' : 'bg-[var(--accent)]'
                }`}
                style={{ animationDuration: `${TOAST_DURATION}ms` }}
              />
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

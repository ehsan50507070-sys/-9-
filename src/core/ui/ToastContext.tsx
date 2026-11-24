// Non-intrusive RTL Toast Notification System
import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, Info, AlertCircle, X } from 'lucide-react';

export type ToastTone = 'success' | 'info' | 'warning' | 'error';

interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, tone: ToastTone = 'success') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { id, message, tone }]);
      window.setTimeout(() => {
        dismiss(id);
      }, 3600);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        className="no-print fixed bottom-20 md:bottom-5 left-4 right-4 md:right-auto md:w-96 z-50 flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((toast) => {
          const toneClasses =
            toast.tone === 'success'
              ? 'bg-emerald-950 text-emerald-50 border-emerald-800'
              : toast.tone === 'error'
                ? 'bg-rose-950 text-rose-50 border-rose-800'
                : toast.tone === 'warning'
                  ? 'bg-amber-950 text-amber-50 border-amber-800'
                  : 'bg-slate-900 text-slate-50 border-slate-700';

          return (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg transition-all ${toneClasses}`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {toast.tone === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                {toast.tone === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                {toast.tone === 'warning' && <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />}
                {toast.tone === 'info' && <Info className="w-4 h-4 text-sky-400 shrink-0" />}
                <span className="leading-5">{toast.message}</span>
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="بستن پیام"
                className="p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

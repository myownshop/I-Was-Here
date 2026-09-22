import { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  duration?: number;
}

let addToastCallback: ((toast: Omit<ToastMessage, 'id'>) => void) | null = null;

export function showToast(type: ToastMessage['type'], message: string, title?: string, duration = 4000) {
  if (addToastCallback) {
    addToastCallback({ type, message, title, duration });
  }
}

export function useToast() {
  return {
    showToast,
    toast: (opts: { type?: ToastMessage['type']; title?: string; message: string; duration?: number }) => {
      showToast(opts.type || 'info', opts.message, opts.title, opts.duration);
    },
  };
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    addToastCallback = (toastData) => {
      const id = `toast_${Date.now()}_${Math.random()}`;
      setToasts((prev) => [...prev, { ...toastData, id }]);
    };

    return () => {
      addToastCallback = null;
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div
      id="toast-container"
      className="fixed top-4 right-4 z-50 flex flex-col space-y-3 max-w-sm w-full pointer-events-none px-4 sm:px-0"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, toast.duration || 4000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const config = {
    success: {
      border: 'border-[#00FF66]/50 shadow-[0_0_20px_rgba(0,255,102,0.15)]',
      icon: <CheckCircle2 className="w-5 h-5 text-[#00FF66] shrink-0" />,
      accent: 'text-[#00FF66]',
    },
    error: {
      border: 'border-rose-500/50 shadow-[0_0_20px_rgba(244,63,94,0.15)]',
      icon: <XCircle className="w-5 h-5 text-rose-400 shrink-0" />,
      accent: 'text-rose-400',
    },
    warning: {
      border: 'border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.15)]',
      icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
      accent: 'text-amber-400',
    },
    info: {
      border: 'border-sky-500/50 shadow-[0_0_20px_rgba(14,165,233,0.15)]',
      icon: <Info className="w-5 h-5 text-sky-400 shrink-0" />,
      accent: 'text-sky-400',
    },
  }[toast.type];

  return (
    <div
      id={`toast-${toast.id}`}
      className={`pointer-events-auto bg-[#12161f] border ${config.border} rounded-xl p-4 flex items-start space-x-3 transition-all transform translate-y-0`}
    >
      {config.icon}
      <div className="flex-1 min-w-0">
        {toast.title && <h4 className={`text-sm font-semibold ${config.accent}`}>{toast.title}</h4>}
        <p className="text-xs text-slate-300 leading-relaxed break-words">{toast.message}</p>
      </div>
      <button
        id={`toast-close-${toast.id}`}
        onClick={onDismiss}
        className="text-slate-500 hover:text-white p-1 rounded transition-colors"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

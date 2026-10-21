import { motion, AnimatePresence } from 'framer-motion';

export interface ToastMessage {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export default function Toast({ toasts, onDismiss }: ToastProps) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full">
      <AnimatePresence>
        {toasts.map((toast) => {
          const isSuccess = toast.type === 'success';
          const isWarning = toast.type === 'warning';
          const isError = toast.type === 'error';

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto p-4 rounded-xl shadow-lg border backdrop-blur-md flex items-start gap-3 ${
                isSuccess
                  ? 'bg-emerald-50/95 border-emerald-200 text-emerald-900'
                  : isWarning
                  ? 'bg-amber-50/95 border-amber-200 text-amber-900'
                  : isError
                  ? 'bg-rose-50/95 border-rose-200 text-rose-900'
                  : 'bg-surface-container-lowest/95 border-primary/20 text-on-surface'
              }`}
            >
              <span className={`material-symbols-outlined text-[22px] shrink-0 ${
                isSuccess ? 'text-emerald-600' : isWarning ? 'text-amber-600' : isError ? 'text-rose-600' : 'text-primary'
              }`}>
                {isSuccess ? 'check_circle' : isWarning ? 'warning' : isError ? 'error' : 'info'}
              </span>

              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm leading-tight">{toast.title}</h4>
                <p className="text-xs mt-0.5 opacity-90 leading-relaxed">{toast.message}</p>
              </div>

              <button
                onClick={() => onDismiss(toast.id)}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-md transition-colors shrink-0"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

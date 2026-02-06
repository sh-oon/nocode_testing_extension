import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
  /** false = entering / visible, true = fading out */
  exiting: boolean;
}

interface AddToastParams {
  type: ToastType;
  message: string;
  /** Auto-dismiss delay in ms. Default 4000. Set 0 to disable. */
  duration?: number;
}

interface ToastContextValue {
  addToast: (params: AddToastParams) => void;
}

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a <ToastProvider>');
  }
  return ctx;
}

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

const FADE_DURATION_MS = 300;

let nextId = 0;
function generateId(): string {
  nextId += 1;
  return `toast-${nextId}-${Date.now()}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Schedule auto-dismiss for a toast
  const scheduleDismiss = useCallback((id: string, duration: number) => {
    if (duration <= 0) return;

    const timer = setTimeout(() => {
      // Start exit animation
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)),
      );

      // Remove after fade-out completes
      const removeTimer = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        timersRef.current.delete(id);
      }, FADE_DURATION_MS);

      timersRef.current.set(`${id}-remove`, removeTimer);
    }, duration);

    timersRef.current.set(id, timer);
  }, []);

  const addToast = useCallback(
    (params: AddToastParams) => {
      const id = generateId();
      const duration = params.duration ?? 4000;

      const item: ToastItem = {
        id,
        type: params.type,
        message: params.message,
        duration,
        exiting: false,
      };

      setToasts((prev) => [...prev, item]);
      scheduleDismiss(id, duration);
    },
    [scheduleDismiss],
  );

  const dismissToast = useCallback((id: string) => {
    // Clear any pending auto-dismiss timer
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }

    // Start exit animation
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)),
    );

    // Remove after fade-out
    const removeTimer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, FADE_DURATION_MS);

    timersRef.current.set(`${id}-remove`, removeTimer);
  }, []);

  // Cleanup all timers on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}

      {/* Toast stack */}
      {toasts.length > 0 && (
        <div
          className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
          aria-live="polite"
          data-test-id="toast-container"
        >
          {toasts.map((toast) => (
            <ToastCard
              key={toast.id}
              toast={toast}
              onDismiss={dismissToast}
            />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  Individual Toast                                                    */
/* ------------------------------------------------------------------ */

const TYPE_STYLES: Record<ToastType, string> = {
  success: 'bg-green-600',
  error: 'bg-red-600',
  warning: 'bg-yellow-600',
  info: 'bg-blue-600',
};

const TYPE_ICONS: Record<ToastType, string> = {
  success: 'M5 13l4 4L19 7',
  error: 'M6 18L18 6M6 6l12 12',
  warning: 'M12 9v2m0 4h.01M12 3l9.5 16.5H2.5L12 3z',
  info: 'M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z',
};

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      className={`
        pointer-events-auto flex items-start gap-2 min-w-[280px] max-w-[400px]
        px-4 py-3 rounded-lg shadow-lg text-white text-sm
        transition-all ease-in-out
        ${TYPE_STYLES[toast.type]}
        ${toast.exiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}
      `}
      style={{ transitionDuration: `${FADE_DURATION_MS}ms` }}
      role="alert"
      data-test-id={`toast-${toast.type}`}
    >
      {/* Icon */}
      <svg
        className="w-5 h-5 shrink-0 mt-0.5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d={TYPE_ICONS[toast.type]}
        />
      </svg>

      {/* Message */}
      <span className="flex-1 leading-snug">{toast.message}</span>

      {/* Close button */}
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 p-0.5 rounded hover:bg-white/20 transition-colors"
        aria-label="토스트 닫기"
        data-test-id="toast-close-button"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}

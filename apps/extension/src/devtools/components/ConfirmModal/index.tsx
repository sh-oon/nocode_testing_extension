import { useCallback, useEffect, useRef } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
  extraAction?: { label: string; onClick: () => void };
}

/* ------------------------------------------------------------------ */
/*  Variant styling                                                    */
/* ------------------------------------------------------------------ */

const CONFIRM_BUTTON_STYLES: Record<NonNullable<ConfirmModalProps['variant']>, string> = {
  danger:
    'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white',
  warning:
    'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500 text-white',
  default:
    'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white',
};

const ICON_COLORS: Record<NonNullable<ConfirmModalProps['variant']>, string> = {
  danger: 'text-red-400',
  warning: 'text-yellow-400',
  default: 'text-blue-400',
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = '확인',
  cancelLabel = '취소',
  variant = 'default',
  onConfirm,
  onCancel,
  extraAction,
}: ConfirmModalProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Focus the cancel button when the modal opens (safer default)
  useEffect(() => {
    if (!isOpen) return;

    // Small delay so the DOM is painted
    const timer = setTimeout(() => {
      cancelButtonRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    },
    [onCancel],
  );

  // Prevent backdrop click from propagating
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onCancel();
      }
    },
    [onCancel],
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-message"
      data-test-id="confirm-modal-backdrop"
    >
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Body */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div
              className={`shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-gray-700 ${ICON_COLORS[variant]}`}
            >
              <VariantIcon variant={variant} />
            </div>

            <div className="flex-1 min-w-0">
              <h3
                id="confirm-modal-title"
                className="text-lg font-semibold text-gray-100 leading-tight"
              >
                {title}
              </h3>
              <p
                id="confirm-modal-message"
                className="mt-2 text-sm text-gray-400 leading-relaxed"
              >
                {message}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-700">
          {/* Extra action (left-aligned when present) */}
          {extraAction && (
            <button
              type="button"
              onClick={extraAction.onClick}
              className="mr-auto px-4 py-2 text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-md transition-colors"
              data-test-id="confirm-modal-extra-action"
            >
              {extraAction.label}
            </button>
          )}

          {/* Cancel */}
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
            data-test-id="confirm-modal-cancel"
          >
            {cancelLabel}
          </button>

          {/* Confirm */}
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-sm rounded-md transition-colors focus:outline-none focus:ring-2 ${CONFIRM_BUTTON_STYLES[variant]}`}
            data-test-id="confirm-modal-confirm"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */

function VariantIcon({ variant }: { variant: NonNullable<ConfirmModalProps['variant']> }) {
  switch (variant) {
    case 'danger':
      return (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      );
    case 'warning':
      return (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    default:
      return (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"
          />
        </svg>
      );
  }
}

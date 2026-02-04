/**
 * Toast and modal feedback (Phase 7)
 * Toast for transient errors; modal for critical errors (e.g. auth).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const TOAST_DURATION_MS = 5000;

export interface ToastOptions {
  /** Optional retry action; button is shown when provided */
  retry?: () => void;
  /** Optional custom retry button label (e.g. "Retry (rate limited)") */
  retryLabel?: string;
}

export interface ToastItem {
  id: string;
  message: string;
  retry?: () => void;
  retryLabel?: string;
  expiresAt: number;
}

interface CriticalModalState {
  title: string;
  message: string;
  onCloseCallback?: () => void;
}

interface FeedbackContextValue {
  toasts: ToastItem[];
  showToast: (message: string, options?: ToastOptions) => void;
  dismissToast: (id: string) => void;
  criticalModal: CriticalModalState | null;
  showCriticalModal: (
    message: string,
    title?: string,
    onClose?: () => void,
  ) => void;
  closeCriticalModal: () => void;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function useFeedback(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext);
  if (ctx == null) {
    throw new Error('useFeedback must be used within FeedbackProvider');
  }
  return ctx;
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [criticalModal, setCriticalModal] = useState<CriticalModalState | null>(null);

  const showToast = useCallback((message: string, options?: ToastOptions) => {
    const id = crypto.randomUUID();
    const item: ToastItem = {
      id,
      message,
      retry: options?.retry,
      retryLabel: options?.retryLabel,
      expiresAt: Date.now() + TOAST_DURATION_MS,
    };
    setToasts((prev) => [...prev, item]);
    if (TOAST_DURATION_MS > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, TOAST_DURATION_MS);
    }
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showCriticalModal = useCallback(
    (message: string, title = 'Error', onCloseCallback?: () => void) => {
      setCriticalModal({ title, message, onCloseCallback });
    },
    [],
  );

  const closeCriticalModal = useCallback(() => {
    setCriticalModal(null);
  }, []);

  const value = useMemo<FeedbackContextValue>(
    () => ({
      toasts,
      showToast,
      dismissToast,
      criticalModal,
      showCriticalModal,
      closeCriticalModal,
    }),
    [
      toasts,
      showToast,
      dismissToast,
      criticalModal,
      showCriticalModal,
      closeCriticalModal,
    ],
  );

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <ToastList toasts={toasts} onDismiss={dismissToast} />
      {criticalModal && (
        <CriticalModal
          title={criticalModal.title}
          message={criticalModal.message}
          onClose={() => {
            criticalModal.onCloseCallback?.();
            closeCriticalModal();
          }}
        />
      )}
    </FeedbackContext.Provider>
  );
}

function ToastList({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div
      className="feedback-toast-list"
      role="region"
      aria-label="Notifications"
      style={{
        position: 'fixed',
        bottom: 'var(--page-padding-bottom)',
        left: 'var(--page-padding)',
        right: 'var(--page-padding-right)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          alignItems: 'stretch',
          maxWidth: 'var(--content-max)',
          marginLeft: 'auto',
          marginRight: 'auto',
          pointerEvents: 'auto',
        }}
      >
        {toasts.map((t) => (
          <ToastItemView key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </div>
    </div>
  );
}

function ToastItemView({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      className="feedback-toast"
      role="alert"
      style={{
        padding: '0.75rem 1rem',
        backgroundColor: 'var(--bg-elevated)',
        border: '1px solid var(--error-border)',
        borderRadius: '8px',
        color: 'var(--error-text)',
        fontSize: '0.9375rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        flexWrap: 'wrap',
      }}
    >
      <span style={{ flex: '1 1 auto', minWidth: 0 }}>{toast.message}</span>
      {toast.retry && (
        <button
          type="button"
          className="touch-target-inline"
          onClick={() => {
            toast.retry?.();
            onDismiss(toast.id);
          }}
          style={{
            flex: '0 0 auto',
            fontSize: '0.875rem',
            fontWeight: 600,
            backgroundColor: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            padding: '0.375rem 0.75rem',
          }}
        >
          {toast.retryLabel ?? 'Retry'}
        </button>
      )}
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
        style={{
          flex: '0 0 auto',
          padding: '0.25rem',
          background: 'none',
          border: 'none',
          color: 'var(--text)',
          cursor: 'pointer',
          fontSize: '1.25rem',
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}

function CriticalModal({
  title,
  message,
  onClose,
}: {
  title: string;
  message: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="feedback-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-modal-title"
      aria-describedby="feedback-modal-desc"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--page-padding)',
        backgroundColor: 'rgba(0,0,0,0.7)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="feedback-modal"
        style={{
          maxWidth: '420px',
          width: '100%',
          padding: '1.5rem',
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--error-border)',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="feedback-modal-title"
          style={{
            margin: '0 0 0.75rem 0',
            fontFamily: 'var(--sans)',
            fontSize: '1.25rem',
            fontWeight: 600,
            color: 'var(--error-text)',
          }}
        >
          {title}
        </h2>
        <p
          id="feedback-modal-desc"
          style={{
            margin: 0,
            color: 'var(--text)',
            fontSize: '0.9375rem',
            lineHeight: 1.5,
          }}
        >
          {message}
        </p>
        <div style={{ marginTop: '1.25rem' }}>
          <button
            type="button"
            className="touch-target-inline"
            onClick={onClose}
            style={{
              width: '100%',
              fontSize: '1rem',
              fontWeight: 600,
              backgroundColor: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

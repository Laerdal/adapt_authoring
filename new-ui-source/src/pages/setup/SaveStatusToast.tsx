import { createPortal } from "react-dom";
import { useEffect, useRef } from "react";

type ToastState = {
  type: "success" | "error";
  message: string;
};

interface SaveStatusToastProps {
  toast: ToastState | null;
  onDismiss: () => void;
  autoHideMs?: number;
}

export function SaveStatusToast({ toast, onDismiss, autoHideMs = 3000 }: SaveStatusToastProps) {
  const dismissRef = useRef(onDismiss);

  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => dismissRef.current(), autoHideMs);
    return () => window.clearTimeout(timer);
  }, [toast, autoHideMs]);

  if (!toast) return null;

  return createPortal(
    <div className="fixed top-6 right-6 z-[200] pointer-events-none">
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border min-w-[260px] max-w-sm ${
          toast.type === "success"
            ? "bg-[var(--life-positive-050)] border-[var(--life-positive-100)] text-[var(--life-positive-500)]"
            : "bg-[var(--life-critical-050)] border-[var(--life-critical-100)] text-[var(--life-critical-500)]"
        }`}
      >
        <span className="shrink-0">
          {toast.type === "success" ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
        </span>
        <span className="flex-1">{toast.message}</span>
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="opacity-60 hover:opacity-100 transition-opacity ml-1">×</button>
      </div>
    </div>,
    document.body,
  );
}
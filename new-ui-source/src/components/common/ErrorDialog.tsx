import { useState, type ReactNode } from "react";

export interface ErrorDialogProps {
  open: boolean;
  title?: ReactNode;
  message: ReactNode;
  debugDetails?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
  onClose: () => void;
}

export default function ErrorDialog({
  open,
  title = "Error",
  message,
  debugDetails,
  primaryLabel = "OK",
  secondaryLabel,
  onPrimary,
  onSecondary,
  onClose,
}: ErrorDialogProps) {
  const [debugOpen, setDebugOpen] = useState(false);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm flex flex-col overflow-hidden">
        <div className="px-6 pt-6 pb-4 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full border-4 border-[#fb5368] flex items-center justify-center mb-4 text-[#fb5368]" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
          <h2 className="font-semibold text-[var(--life-neutral-850)] text-base mb-3">{title}</h2>
          <div className="text-sm text-[var(--life-neutral-600)]">{message}</div>

          {debugDetails && (
            <div className="mt-5 w-full text-left">
              <button
                type="button"
                onClick={() => setDebugOpen((value) => !value)}
                className="mx-auto flex items-center gap-2 text-sm font-medium text-[var(--life-neutral-600)] hover:text-[var(--life-neutral-700)] transition-colors"
                aria-expanded={debugOpen}
              >
                <span aria-hidden="true" className={`inline-block transition-transform ${debugOpen ? "rotate-90" : ""}`}>▶</span>
                Debug information
              </button>
              {debugOpen && (
                <pre className="mt-3 max-h-40 overflow-auto rounded-lg border border-[var(--life-neutral-100)] bg-[var(--life-neutral-020)] p-3 text-left text-xs leading-relaxed text-[var(--life-neutral-700)] whitespace-pre-wrap break-words">
                  {debugDetails}
                </pre>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[var(--life-neutral-100)]">
          {secondaryLabel && (
            <button
              type="button"
              onClick={onSecondary ?? onClose}
              className="px-4 py-2 text-sm font-medium text-[var(--life-neutral-700)] bg-white border border-[var(--life-neutral-200)] rounded-lg hover:bg-[var(--life-neutral-020)] transition-colors cursor-pointer"
            >
              {secondaryLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onPrimary ?? onClose}
            className="px-5 py-2 text-sm font-semibold text-white bg-[var(--life-primary-500)] hover:bg-[var(--life-primary-600)] rounded-lg transition-colors cursor-pointer"
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
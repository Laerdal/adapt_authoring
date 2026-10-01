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
          <h2 className="font-semibold text-[#111827] text-base mb-3">{title}</h2>
          <div className="text-sm text-[#6b7280]">{message}</div>

          {debugDetails && (
            <div className="mt-5 w-full text-left">
              <button
                type="button"
                onClick={() => setDebugOpen((value) => !value)}
                className="mx-auto flex items-center gap-2 text-sm font-medium text-[#6b7280] hover:text-[#374151] transition-colors"
                aria-expanded={debugOpen}
              >
                <span aria-hidden="true" className={`inline-block transition-transform ${debugOpen ? "rotate-90" : ""}`}>▶</span>
                Debug information
              </button>
              {debugOpen && (
                <pre className="mt-3 max-h-40 overflow-auto rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-3 text-left text-xs leading-relaxed text-[#4b5563] whitespace-pre-wrap break-words">
                  {debugDetails}
                </pre>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[#e5e7eb]">
          {secondaryLabel && (
            <button
              type="button"
              onClick={onSecondary ?? onClose}
              className="px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#d1d5db] rounded-lg hover:bg-[#f9fafb] transition-colors cursor-pointer"
            >
              {secondaryLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onPrimary ?? onClose}
            className="px-5 py-2 text-sm font-semibold text-white bg-[#2d6fa8] hover:bg-[#245c8f] rounded-lg transition-colors cursor-pointer"
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
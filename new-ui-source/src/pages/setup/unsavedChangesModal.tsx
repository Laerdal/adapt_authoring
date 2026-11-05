import { useEffect } from "react";
import { createPortal } from "react-dom";

export function UnsavedChangesModal({
  isOpen,
  isSaving,
  onDiscard,
  onSave,
  onClose,
  title = "Unsaved Changes",
  message = "You have unsaved changes. Do you want to save them?",
  discardLabel = "Discard",
  saveLabel = "Save",
  savingLabel = "Saving...",
}: {
  isOpen: boolean;
  isSaving?: boolean;
  onDiscard: () => void;
  onSave: () => void;
  onClose?: () => void;
  title?: string;
  message?: string;
  discardLabel?: string;
  saveLabel?: string;
  savingLabel?: string;
}) {
  useEffect(() => {
    if (!isOpen) return;

    document.body.setAttribute("data-unsaved-changes-modal-open", "true");

    return () => {
      document.body.removeAttribute("data-unsaved-changes-modal-open");
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center" style={{ zIndex: 99999 }}>
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-lg font-semibold text-[var(--life-neutral-850)]">{title}</h3>
          <button
            type="button"
            aria-label="Close unsaved changes popup"
            onClick={onClose}
            disabled={isSaving}
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-[8px] border border-transparent bg-white text-[var(--life-neutral-400)] transition-colors cursor-pointer hover:bg-[var(--life-critical-050)] hover:text-[var(--life-critical-600)] hover:border-[var(--life-critical-050)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <p className="text-sm text-[var(--life-neutral-600)] mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onDiscard}
            disabled={isSaving}
            className="flex-1 px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--life-neutral-700)] bg-[var(--life-neutral-050)] hover:bg-[var(--life-neutral-100)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {discardLabel}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="life-btn life-btn--primary"
          >
            {isSaving ? savingLabel : saveLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

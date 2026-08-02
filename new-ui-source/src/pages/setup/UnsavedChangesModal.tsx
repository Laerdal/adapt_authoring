import { createPortal } from "react-dom";

export function UnsavedChangesModal({
  isOpen,
  isSaving,
  onDiscard,
  onSave,
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
  title?: string;
  message?: string;
  discardLabel?: string;
  saveLabel?: string;
  savingLabel?: string;
}) {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center" style={{ zIndex: 99999 }}>
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4">
        <h3 className="text-lg font-semibold text-[#111827] mb-2">{title}</h3>
        <p className="text-sm text-[#6b7280] mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onDiscard}
            disabled={isSaving}
            className="flex-1 px-3 py-2.5 rounded-lg text-sm font-medium text-[#374151] bg-[#f3f4f6] hover:bg-[#e5e7eb] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {discardLabel}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="flex-1 px-3 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#2d6fa8] hover:bg-[#235694] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? savingLabel : saveLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

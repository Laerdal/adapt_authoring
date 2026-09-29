import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";

interface SaveChangesButtonProps {
  dirty: boolean;
  saving: boolean;
  onClick: () => void;
  className?: string;
  portalTargetId?: string;
}

export function SaveChangesButton({ dirty, saving, onClick, className, portalTargetId }: SaveChangesButtonProps) {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!portalTargetId) {
      setPortalTarget(null);
      return;
    }

    setPortalTarget(document.getElementById(portalTargetId));
  }, [portalTargetId]);

  const button = (
    <button
      type="button"
      onClick={onClick}
      disabled={!dirty || saving}
      className={
        className ??
        "inline-flex items-center gap-2 rounded-lg border border-[#d1d5db] bg-white px-4 py-2 text-sm font-semibold text-[#111827] transition-colors cursor-pointer hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-50"
      }
      title="Save changes"
    >
      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      {saving ? "Saving…" : "Save"}
    </button>
  );

  if (portalTarget) {
    return createPortal(button, portalTarget);
  }

  return button;
}
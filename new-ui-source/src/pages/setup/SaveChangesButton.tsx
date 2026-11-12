import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";

interface SaveChangesButtonProps {
  dirty: boolean;
  saving: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  portalTargetId?: string;
}

export function SaveChangesButton({ dirty, saving, disabled = false, onClick, className, portalTargetId }: SaveChangesButtonProps) {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!portalTargetId) {
      setPortalTarget(null);
      return;
    }

    const updatePortalTarget = () => {
      const nextTarget = document.getElementById(portalTargetId);
      setPortalTarget((currentTarget) => (currentTarget === nextTarget ? currentTarget : nextTarget));
    };

    updatePortalTarget();

    const observer = new MutationObserver(() => {
      updatePortalTarget();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, [portalTargetId]);

  const button = (
    <button
      type="button"
      onClick={onClick}
      disabled={!dirty || saving || disabled}
      className={
        className ??
        "life-btn life-btn--ghost !px-3"
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
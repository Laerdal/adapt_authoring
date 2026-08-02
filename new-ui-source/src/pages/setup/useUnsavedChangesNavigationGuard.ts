import { useEffect, useState } from "react";

export function useUnsavedChangesNavigationGuard({
  hasChanges,
  pendingNavigation,
  onPendingNavigationHandled,
  onNavigate,
}: {
  hasChanges: boolean;
  pendingNavigation?: string | null;
  onPendingNavigationHandled?: () => void;
  onNavigate?: (nav: string) => void;
}) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingNavTarget, setPendingNavTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!hasChanges) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasChanges]);

  useEffect(() => {
    if (!pendingNavigation) return;
    onPendingNavigationHandled?.();

    if (hasChanges) {
      setPendingNavTarget(pendingNavigation);
      setShowConfirmModal(true);
      return;
    }

    onNavigate?.(pendingNavigation);
  }, [pendingNavigation, hasChanges, onPendingNavigationHandled, onNavigate]);

  const consumePendingNavigation = () => {
    const target = pendingNavTarget;
    setShowConfirmModal(false);
    setPendingNavTarget(null);
    return target;
  };

  const clearPendingNavigation = () => {
    setShowConfirmModal(false);
    setPendingNavTarget(null);
  };

  return {
    showConfirmModal,
    consumePendingNavigation,
    clearPendingNavigation,
  };
}

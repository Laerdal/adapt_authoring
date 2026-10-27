import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export interface GuidePanel {
  title: string;
  description: string;
}

export interface GuideSection {
  title: string;
  description?: string;
  items: string[];
}

export interface GuideDialogProps {
  open: boolean;
  title: string;
  description: string;
  panels: GuidePanel[];
  sections: GuideSection[];
  onClose: () => void;
}

export default function GuideDialog({
  open,
  title,
  description,
  panels,
  sections,
  onClose,
}: GuideDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const portalNodeRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  if (!portalNodeRef.current && typeof document !== "undefined") {
    portalNodeRef.current = document.createElement("div");
  }

  useEffect(() => {
    const portalNode = portalNodeRef.current;
    if (!open || !portalNode) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const inertStates = new Map<HTMLElement, boolean>();
    const previousOverflow = document.body.style.overflow;

    document.body.appendChild(portalNode);
    for (const child of Array.from(document.body.children)) {
      if (child === portalNode || !(child instanceof HTMLElement)) continue;
      inertStates.set(child, child.inert);
      child.inert = true;
    }
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter((element) => element.offsetParent !== null);

      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      for (const [element, wasInert] of inertStates) element.inert = wasInert;
      portalNode.remove();
      if (previouslyFocused?.isConnected) requestAnimationFrame(() => previouslyFocused.focus());
    };
  }, [open]);

  if (!open || !portalNodeRef.current) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] grid place-items-center overflow-y-auto bg-[#111827]/55 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-dialog-title"
        aria-describedby="guide-dialog-description"
        tabIndex={-1}
        className="my-auto flex max-h-[min(90dvh,900px)] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-[#d8dee6] bg-white shadow-2xl outline-none"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#e5e9ef] px-5 py-4 sm:px-7">
          <div className="min-w-0">
            <h2 id="guide-dialog-title" className="text-lg font-semibold text-[#17212b]">{title}</h2>
            <p id="guide-dialog-description" className="mt-1 max-w-3xl text-sm leading-5 text-[#586673]">{description}</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close guide"
            title="Close guide"
            className="-mr-1 -mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[#52606d] hover:bg-[#f1f4f7] hover:text-[#15202b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2d6fa8]"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          <div className="grid gap-3 md:grid-cols-3">
            {panels.map((panel, index) => (
              <section key={panel.title} className="border-l-2 border-[#2d6fa8] bg-[#f5f8fb] px-4 py-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#526b7e]">0{index + 1}</p>
                <h3 className="mt-1 text-sm font-semibold text-[#17212b]">{panel.title}</h3>
                <p className="mt-1.5 text-sm leading-5 text-[#586673]">{panel.description}</p>
              </section>
            ))}
          </div>

          <div className="mt-6 grid gap-x-8 gap-y-6 md:grid-cols-2">
            {sections.map((section) => (
              <section key={section.title} className="min-w-0">
                <h3 className="text-sm font-semibold text-[#17212b]">{section.title}</h3>
                {section.description && <p className="mt-1 text-sm leading-5 text-[#586673]">{section.description}</p>}
                <ul className="mt-2 space-y-2">
                  {section.items.map((item) => (
                    <li key={item} className="flex gap-2 text-sm leading-5 text-[#485663]">
                      <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#2d6fa8]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>,
    portalNodeRef.current
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
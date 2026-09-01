// "Publish ▾" dropdown — Figma-aligned entry point for the Publish workflow.
// Two items: Preflight Validation (navigates to the Preflight Validator settings
// page) and Publish Course (opens the build+package dialog). Positioning/outside
// -click/close-on-scroll logic mirrors StoryboardTopBar.tsx's `Dropdown`, extended
// here to render an icon + title + subtitle per item instead of a bare label.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const ICON_BASE = "/new/assets/icons";

function MaskIcon({ file, className }: { file: string; className?: string }) {
  const iconPath = `${ICON_BASE}/${file}`;
  return (
    <span
      aria-hidden="true"
      className={className ?? "block w-[14px] h-[14px] shrink-0 bg-current"}
      style={{
        WebkitMaskImage: `url(${iconPath})`,
        maskImage: `url(${iconPath})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}

interface PublishMenuButtonProps {
  active?: boolean;
  disabled?: boolean;
  onSelectPreflight: () => void;
  onSelectPublish: () => void;
}

export default function PublishMenuButton({
  active = false,
  disabled = false,
  onSelectPreflight,
  onSelectPublish,
}: PublishMenuButtonProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const MENU_WIDTH = 260;

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const left = Math.min(r.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8);
    setPos({ left: Math.max(8, left), top: r.bottom + 6 });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  const items = [
    {
      key: "preflight",
      icon: "preflight-icon.svg",
      label: "Preflight Validation",
      subtitle: "Check readiness before publish",
      onSelect: onSelectPreflight,
    },
    {
      key: "publish-course",
      icon: "publish-icon.svg",
      label: "Publish Course",
      subtitle: "Deploy to LMS / CDN",
      onSelect: onSelectPublish,
    },
  ];

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-bold rounded-[8px] transition-colors active:bg-[var(--life-primary-800)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
          active
            ? "bg-[var(--life-primary-700)] text-[var(--life-base-white)]"
            : "bg-[var(--life-primary-500)] text-[var(--life-base-white)] hover:bg-[var(--life-primary-700)]"
        }`}
      >
        <MaskIcon file="publish-icon.svg" className="block w-[14px] h-[14px] shrink-0 bg-current" />
        <span className="hidden lg:inline">Publish</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="rounded-xl border border-[#e5e7eb] bg-white shadow-lg overflow-hidden py-1.5"
            style={{ position: "fixed", left: pos.left, top: pos.top, width: MENU_WIDTH, zIndex: 1000 }}
          >
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className="w-full flex items-start gap-2.5 px-3.5 py-2.5 text-left hover:bg-[var(--life-primary-020)] transition-colors"
              >
                <span className="mt-0.5 w-6 h-6 rounded-md bg-[var(--life-primary-050)] text-[var(--life-primary-700)] flex items-center justify-center shrink-0">
                  <MaskIcon file={item.icon} className="block w-[12px] h-[12px] shrink-0 bg-current" />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-semibold text-[#111827]">{item.label}</span>
                  <span className="text-xs text-[#6b7280] mt-0.5">{item.subtitle}</span>
                </span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

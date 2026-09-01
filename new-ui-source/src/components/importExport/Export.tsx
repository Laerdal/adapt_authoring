import { useEffect, useRef, useState } from "react";

interface ExportMenuProps {
  onExportSource?: () => void;
  onExportPdf?: () => void;
  disabled?: boolean;
  exportSourceLoading?: boolean;
}

interface ExportOption {
  id: "source" | "pdf";
  label: string;
  onSelect?: () => void;
  disabled?: boolean;
}

export function ExportStatusPopup({
  status,
  message,
}: {
  status: "processing" | "success";
  message: string;
}) {
  return (
    <div
      className={`fixed top-6 right-6 z-[9999] flex items-center gap-3 min-w-[380px] max-w-[440px] px-5 py-3.5 rounded-[10px] shadow-[0_10px_30px_rgba(0,0,0,0.24)] border transition-all duration-200 ${
        status === "success"
          ? "bg-[#16a34a] border-[#15803d] text-white"
          : "bg-[#4b5563] border-[#374151] text-white"
      }`}
      role="status"
      aria-live="polite"
    >
      {status === "success" ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" className="animate-spin shrink-0">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      )}
      <span className="text-[14px] font-semibold whitespace-nowrap">{message}</span>
    </div>
  );
}

const ICON_BASE = "/new/assets/icons";

function SidebarMaskIcon({ file, className }: { file: string; className?: string }) {
  const iconPath = `${ICON_BASE}/${file}`;
  return (
    <span
      aria-hidden="true"
      className={className ?? "block w-[18px] h-[18px] bg-current"}
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

export default function ExportMenu({
  onExportSource,
  onExportPdf,
  disabled = false,
  exportSourceLoading = false,
}: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleDocumentMouseDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleDocumentMouseDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const options: ExportOption[] = [
    { id: "source", label: exportSourceLoading ? "Export Source..." : "Export Source", onSelect: onExportSource, disabled: exportSourceLoading },
    { id: "pdf", label: "Export as PDF", onSelect: onExportPdf },
  ];

  function onOptionClick(option: ExportOption) {
    if (option.disabled) return;
    setIsOpen(false);
    option.onSelect?.();
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-bold bg-transparent text-[var(--life-base-black)] rounded-[8px] hover:bg-[var(--life-primary-050)] hover:text-[var(--life-primary-700)] active:bg-[var(--life-primary-100)] active:text-[var(--life-primary-800)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <SidebarMaskIcon file="export-icon.svg" className="block w-[14px] h-[14px] shrink-0 bg-current" />
        <span className="hidden lg:inline">Export</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-[248px] rounded-[12px] border border-[#d1d5db] bg-white py-2 shadow-[0_10px_25px_rgba(17,24,39,0.12)] z-30"
        >
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              role="menuitem"
              onClick={() => onOptionClick(option)}
              disabled={option.disabled}
              className="block w-full px-5 py-3 text-left font-[var(--font-family-primary)] text-[16px] leading-[1.3] text-[#1f2937] hover:bg-[#f8fafc] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

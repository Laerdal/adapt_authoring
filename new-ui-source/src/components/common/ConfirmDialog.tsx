import type * as React from "react";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  note?: React.ReactNode;
  variant?: "danger" | "success";
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

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

export default function ConfirmDialog({
  open,
  title,
  message,
  note,
  variant = "danger",
  confirmLabel = "Yes, I'm sure",
  cancelLabel = "No",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  const variantStyles = {
    danger: {
      iconBg: "bg-[var(--life-critical-100)]",
      iconColor: "bg-[var(--life-critical-600)]",
      iconFile: "delete-icon.svg",
      confirmClassName: "life-btn--danger",
    },
    success: {
      iconBg: "bg-[#ecfdf5]",
      iconColor: "bg-[#16a34a]",
      iconFile: null,
      confirmClassName: "life-btn--primary",
    },
  }[variant];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm flex flex-col overflow-hidden">
        <div className="px-6 pt-6 pb-4 flex flex-col items-center text-center">
          <div className={`w-12 h-12 rounded-full ${variantStyles.iconBg} flex items-center justify-center mb-4`}>
            {variantStyles.iconFile ? (
              <MaskIcon file={variantStyles.iconFile} className={`block w-[22px] h-[22px] shrink-0 ${variantStyles.iconColor}`} />
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[#16a34a]">
                <path d="M5 12l4 4L19 2" />
              </svg>
            )}
          </div>
          <h2 className="font-semibold text-[var(--life-neutral-850)] text-base mb-3">{title}</h2>
          <div className="text-sm text-[var(--life-neutral-600)] space-y-5">
            <p>{message}</p>
            {note && (
              <p>
                <span className="font-semibold text-[var(--life-neutral-600)]">IMPORTANT:</span> {note}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[var(--life-neutral-100)]">
          <button
            type="button"
            onClick={onCancel}
            className="life-btn life-btn--secondary"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`life-btn ${variantStyles.confirmClassName}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

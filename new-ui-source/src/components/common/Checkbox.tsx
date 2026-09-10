import type { ReactNode } from "react";

// Single source of truth for the app's checkbox look (Course Setup ›
// Navigation › Navigation Footer buttons is where this design originated) —
// a hidden native <input> (real keyboard/a11y semantics) driving a styled
// square indicator with a checkmark, never the browser's native appearance.
export function CheckboxIndicator({ checked, className }: { checked: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={
        className ??
        `w-4 h-4 rounded shrink-0 border-2 flex items-center justify-center transition-colors ${
          checked ? "bg-[var(--life-primary-500)] border-[var(--life-primary-500)]" : "border-[#d1d5db] bg-white"
        }`
      }
    >
      {checked && (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </span>
  );
}

export default function Checkbox({
  checked,
  onChange,
  label,
  disabled = false,
  ariaLabel,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <label
      className={
        className ??
        `flex items-start gap-3 py-2 px-2 rounded-lg cursor-pointer group ${disabled ? "opacity-40 pointer-events-none" : "hover:bg-[#f9fafb]"}`
      }
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel ?? (typeof label === "string" ? label : undefined)}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only peer"
      />
      <span
        aria-hidden="true"
        className="mt-0.5 w-4 h-4 rounded shrink-0 border-2 flex items-center justify-center transition-colors peer-checked:bg-[var(--life-primary-500)] peer-checked:border-[var(--life-primary-500)] border-[#d1d5db] bg-white group-hover:border-[#93c5fd] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--life-primary-500)] peer-focus-visible:ring-offset-1"
      >
        {checked && (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
      {label && <span className="text-sm text-[#374151] leading-snug">{label}</span>}
    </label>
  );
}

import React from "react";

interface InfoIconProps {
  label: string;
  hint?: string;
  className?: string;
  iconClassName?: string;
  tooltipClassName?: string;
}

export function InfoIcon({
  label,
  hint,
  className = "",
  iconClassName = "",
  tooltipClassName = "",
}: InfoIconProps) {
  const tooltipId = React.useId();

  if (!hint) return null;

  return (
    <span
      className={`relative inline-flex group ${className}`}
      tabIndex={0}
      aria-label={`More information about ${label}`}
      aria-describedby={tooltipId}
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#9ca3af"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={iconClassName}
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span
        id={tooltipId}
        role="tooltip"
        className={`pointer-events-none absolute left-0 bottom-full z-20 mb-1.5 w-max max-w-[240px] rounded-[8px] bg-[#215369] px-3 py-1 text-[11px] font-medium text-[#ffffff] opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 ${tooltipClassName}`}
      >
        {hint}
      </span>
    </span>
  );
}

interface InfoFieldLabelProps {
  label: string;
  hint?: string;
  className?: string;
  iconClassName?: string;
  tooltipClassName?: string;
}

export function InfoFieldLabel({
  label,
  hint,
  className = "",
  iconClassName = "",
  tooltipClassName = "",
}: InfoFieldLabelProps) {
  return (
    <span className={`text-xs font-semibold text-[#374151] flex items-center gap-1 ${className}`}>
      {label}
      {hint && (
        <InfoIcon
          label={label}
          hint={hint}
          iconClassName={iconClassName}
          tooltipClassName={tooltipClassName}
        />
      )}
    </span>
  );
}

export default InfoIcon;

import React from "react";

function stopPropagation(event: React.SyntheticEvent) {
  event.stopPropagation();
}

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

  return (
    <span
      className={`relative inline-flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full border border-[#cbd5e1] bg-white text-[#64748b] group ${hint ? 'cursor-help' : 'cursor-default'} ${className}`}
      tabIndex={hint ? 0 : undefined}
      aria-label={hint ? `More information about ${label}` : undefined}
      aria-describedby={hint ? tooltipId : undefined}
      aria-hidden={hint ? undefined : true}
      onClick={hint ? stopPropagation : undefined}
      onMouseDown={hint ? stopPropagation : undefined}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={iconClassName}
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      {hint && (
        <span
          id={tooltipId}
          role="tooltip"
          className={`pointer-events-none absolute left-0 bottom-full z-[9999] mb-1.5 w-max max-w-[240px] rounded-[8px] bg-[#215369] px-3 py-1 text-[11px] font-medium text-[#ffffff] opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 ${tooltipClassName}`}
        >
          {hint}
        </span>
      )}
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
    <div className={`relative z-10 flex min-w-0 items-start gap-1 text-xs font-semibold text-[#374151] ${className}`}>
      <span className="min-w-0 flex-1 break-words leading-snug">
        {label}
      </span>
      <InfoIcon
        label={label}
        hint={hint}
        className="mt-[1px]"
        iconClassName={iconClassName}
        tooltipClassName={tooltipClassName}
      />
    </div>
  );
}

export default InfoIcon;

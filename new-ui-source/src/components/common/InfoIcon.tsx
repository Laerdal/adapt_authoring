import React from "react";
import { createPortal } from "react-dom";

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
  const triggerRef = React.useRef<HTMLSpanElement | null>(null);
  const tooltipRef = React.useRef<HTMLSpanElement | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);
  const [tooltipStyle, setTooltipStyle] = React.useState<React.CSSProperties>({
    position: "fixed",
    left: 0,
    top: 0,
    opacity: 0,
  });

  const hasHint = typeof hint === "string" && hint.trim().length > 0;

  const updateTooltipPosition = React.useCallback(() => {
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    if (!trigger || !tooltip || !hasHint) return;

    const viewportMargin = 8;
    const gap = 6;
    const triggerRect = trigger.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    const maxLeft = Math.max(viewportMargin, window.innerWidth - tooltipRect.width - viewportMargin);
    const left = Math.min(Math.max(triggerRect.left, viewportMargin), maxLeft);

    const preferredTop = triggerRect.top - tooltipRect.height - gap;
    const top = preferredTop >= viewportMargin
      ? preferredTop
      : Math.min(
          window.innerHeight - tooltipRect.height - viewportMargin,
          triggerRect.bottom + gap,
        );

    setTooltipStyle({
      position: "fixed",
      left,
      top,
      opacity: 1,
    });
  }, [hasHint]);

  React.useLayoutEffect(() => {
    if (!isOpen || !hasHint) return;

    updateTooltipPosition();

    const handleReposition = () => updateTooltipPosition();
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [hasHint, isOpen, updateTooltipPosition]);

  return (
    <>
      <span
        ref={triggerRef}
        className={`relative inline-flex h-[16px] w-[16px] shrink-0 items-center justify-center text-[#64748b] ${hasHint ? "cursor-help" : "cursor-default"} ${className}`}
        aria-label={hasHint ? `More information about ${label}` : undefined}
        aria-describedby={hasHint ? tooltipId : undefined}
        aria-hidden={hasHint ? undefined : true}
        onClick={hasHint ? stopPropagation : undefined}
        onMouseDown={hasHint ? stopPropagation : undefined}
        onMouseEnter={hasHint ? () => setIsOpen(true) : undefined}
        onMouseLeave={hasHint ? () => setIsOpen(false) : undefined}
        onFocus={hasHint ? () => setIsOpen(true) : undefined}
        onBlur={hasHint ? () => setIsOpen(false) : undefined}
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
      </span>
      {hasHint && isOpen && typeof document !== "undefined"
        ? createPortal(
            <span
              ref={tooltipRef}
              id={tooltipId}
              role="tooltip"
              className={`pointer-events-none z-[9999] w-max max-w-[240px] rounded-[8px] bg-[#215369] px-3 py-1 text-[11px] font-medium text-[#ffffff] shadow-lg ${tooltipClassName}`}
              style={tooltipStyle}
            >
              {hint}
            </span>,
            document.body,
          )
        : null}
    </>
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
  const hasHint = typeof hint === "string" && hint.trim().length > 0;

  return (
    <div className={`relative z-10 min-w-0 text-xs font-semibold text-[#374151] ${className}`}>
      <span className="leading-snug">
        {label}
        {hasHint && (
          <InfoIcon
            label={label}
            hint={hint}
            className="ml-1 inline-flex align-middle translate-y-[-1px]"
            iconClassName={iconClassName}
            tooltipClassName={tooltipClassName}
          />
        )}
      </span>
    </div>
  );
}

export default InfoIcon;

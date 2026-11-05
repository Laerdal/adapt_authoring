// Reusable Button component following LIFE design system.
// Styling lives in life-components.css (.life-btn*), built on the LIFE tokens.

import { cn } from "@/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "text" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

/** Class string for non-<button> elements (e.g. react-router <Link>) that must look like a LIFE button. */
export function lifeButtonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn("life-btn", `life-btn--${variant}`, size !== "md" && `life-btn--${size}`, className);
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  children: React.ReactNode;
}

export default function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={lifeButtonClass(variant, size, className)}
      {...props}
    >
      {isLoading ? (
        <>
          <span className="w-4 h-4 border-2 border-current border-r-transparent rounded-full animate-spin" />
          {children}
        </>
      ) : (
        children
      )}
    </button>
  );
}

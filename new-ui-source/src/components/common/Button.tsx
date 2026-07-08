// Reusable Button component following LIFE design system

import { cn } from "@/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
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
  ...props
}: ButtonProps) {
  const baseStyles = "inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-colors";

  const variantStyles = {
    primary: "bg-[#2d6fa8] hover:bg-[#245c8f] text-white disabled:bg-[#9ca3af] disabled:cursor-not-allowed",
    secondary: "bg-white border border-[#e5e7eb] text-[#374151] hover:bg-[#f9fafb] disabled:bg-[#f3f4f6] disabled:cursor-not-allowed",
    ghost: "text-[#374151] hover:bg-[#f3f4f6] disabled:cursor-not-allowed",
    danger: "bg-[#ef4444] hover:bg-[#dc2626] text-white disabled:bg-[#9ca3af] disabled:cursor-not-allowed",
  };

  const sizeStyles = {
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-2.5 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
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

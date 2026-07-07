// Reusable Card component

import { cn } from "@/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: "default" | "bordered" | "elevated";
}

export default function Card({
  className,
  variant = "default",
  children,
  ...props
}: CardProps) {
  const variantStyles = {
    default: "bg-white rounded-lg border border-[#e5e7eb]",
    bordered: "bg-white rounded-lg border-2 border-[#e5e7eb]",
    elevated: "bg-white rounded-lg shadow-lg",
  };

  return (
    <div className={cn(variantStyles[variant], className)} {...props}>
      {children}
    </div>
  );
}

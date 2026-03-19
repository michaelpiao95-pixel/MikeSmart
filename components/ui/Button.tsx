import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "ghost" | "destructive" | "outline";
  size?: "sm" | "md" | "lg" | "icon";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          // Base
          "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50 disabled:pointer-events-none select-none",
          // Variants
          {
            "bg-brand-600 hover:bg-brand-700 text-white active:scale-[0.98]":
              variant === "default",
            "bg-surface-3 hover:bg-surface-4 text-foreground border border-border active:scale-[0.98]":
              variant === "secondary",
            "hover:bg-surface-3 text-muted-foreground hover:text-foreground":
              variant === "ghost",
            "bg-red-600/90 hover:bg-red-600 text-white active:scale-[0.98]":
              variant === "destructive",
            "border border-border hover:bg-surface-3 text-foreground active:scale-[0.98]":
              variant === "outline",
          },
          // Sizes
          {
            "text-xs px-2.5 py-1.5 h-7": size === "sm",
            "text-sm px-3 py-2 h-9": size === "md",
            "text-sm px-4 py-2.5 h-10": size === "lg",
            "w-8 h-8 p-0": size === "icon",
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };

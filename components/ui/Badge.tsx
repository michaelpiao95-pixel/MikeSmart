import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "red" | "orange" | "green" | "blue" | "purple";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium",
        {
          "bg-surface-4 text-muted-foreground": variant === "default",
          "bg-red-950/60 text-red-400 border border-red-900/50": variant === "red",
          "bg-orange-950/60 text-orange-400 border border-orange-900/50": variant === "orange",
          "bg-emerald-950/60 text-emerald-400 border border-emerald-900/50": variant === "green",
          "bg-blue-950/60 text-blue-400 border border-blue-900/50": variant === "blue",
          "bg-purple-950/60 text-purple-400 border border-purple-900/50": variant === "purple",
        },
        className
      )}
    >
      {children}
    </span>
  );
}

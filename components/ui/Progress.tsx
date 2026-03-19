import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number; // 0-100
  className?: string;
  barClassName?: string;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

export function Progress({
  value,
  className,
  barClassName,
  showLabel = false,
  size = "md",
}: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));

  const getColor = () => {
    if (clamped >= 80) return "bg-emerald-500";
    if (clamped >= 50) return "bg-brand-500";
    if (clamped >= 25) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn("flex-1 bg-surface-4 rounded-full overflow-hidden", {
          "h-1": size === "sm",
          "h-2": size === "md",
          "h-3": size === "lg",
        })}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            getColor(),
            barClassName
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-medium text-muted-foreground tabular-nums w-8 text-right">
          {Math.round(clamped)}%
        </span>
      )}
    </div>
  );
}

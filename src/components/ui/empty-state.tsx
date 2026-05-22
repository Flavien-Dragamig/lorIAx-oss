// src/components/ui/empty-state.tsx
import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  size = "md",
}: EmptyStateProps) {
  const iconSize = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-14 w-14" : "h-10 w-10";
  const containerSize = size === "sm" ? "py-8" : size === "lg" ? "py-20" : "py-14";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        containerSize,
        className
      )}
    >
      <div className="es-icon-wrap mb-4">
        <div
          className={cn(
            "rounded-2xl bg-muted flex items-center justify-center",
            size === "sm" ? "p-3" : "p-4"
          )}
        >
          <Icon className={cn(iconSize, "text-muted-foreground")} />
        </div>
      </div>

      <h3 className={cn("font-semibold text-foreground mb-1", size === "sm" ? "text-sm" : "text-base")}>
        {title}
      </h3>

      {description && (
        <p className={cn("text-muted-foreground max-w-xs mb-4", size === "sm" ? "text-xs" : "text-sm")}>
          {description}
        </p>
      )}

      {action && <div>{action}</div>}
    </div>
  );
}

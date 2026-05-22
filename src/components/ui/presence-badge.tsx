import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  online: "#22c55e",
  away: "#f59e0b",
  in_meeting: "#f59e0b",
  dnd: "#ef4444",
  offline: "#cbd5e1",
};

const SIZES = {
  sm: 8,
  md: 10,
  lg: 12,
};

interface PresenceBadgeProps {
  status: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function PresenceBadge({ status, size = "md", className }: PresenceBadgeProps) {
  const px = SIZES[size];
  const color = STATUS_COLORS[status] ?? STATUS_COLORS.offline;
  return (
    <span
      className={cn("absolute bottom-0 right-0 rounded-full ring-2 ring-background", className)}
      style={{ width: px, height: px, backgroundColor: color }}
    />
  );
}

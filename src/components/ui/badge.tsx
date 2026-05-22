import { cn } from "@/lib/utils";

interface BadgeProps extends React.ComponentProps<"div"> {
  variant?: "default" | "secondary" | "outline" | "destructive";
}

const VARIANT_STYLES = {
  default: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  outline: "border border-border text-foreground bg-transparent",
  destructive: "bg-destructive text-destructive-foreground",
};

function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
        VARIANT_STYLES[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };

"use client";

interface LabelBadgeProps {
  label: { id: string; name: string; color: string };
  size?: "sm" | "md";
  onRemove?: () => void;
}

export function LabelBadge({ label, size = "md", onRemove }: LabelBadgeProps) {
  const { name, color } = label;

  const maxChars = size === "sm" ? 12 : 20;
  const displayName = name.length > maxChars ? name.slice(0, maxChars) + "…" : name;

  const sizeClasses =
    size === "sm"
      ? "text-xs px-1.5 py-0.5 rounded"
      : "text-sm px-2 py-0.5 rounded-md";

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium ${sizeClasses}`}
      style={{ backgroundColor: color + "33", color }}
      title={name}
    >
      <span>{displayName}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="text-current opacity-60 hover:opacity-100 leading-none"
          aria-label={`Retirer le label ${name}`}
        >
          ×
        </button>
      )}
    </span>
  );
}

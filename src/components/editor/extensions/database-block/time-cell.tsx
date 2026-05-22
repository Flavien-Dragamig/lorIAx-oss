"use client";

interface TimeCellProps {
  value: string | null | undefined;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export function TimeCell({ value, onChange, readOnly }: TimeCellProps) {
  const displayValue = value || "—";

  // Read-only mode: display as text
  if (readOnly) {
    return <div className="px-2 py-1 text-sm text-foreground">{displayValue}</div>;
  }

  // Empty cell: display placeholder
  if (!value) {
    return (
      <div className="px-2 py-1">
        <input
          type="time"
          value=""
          onChange={(e) => onChange(e.target.value.slice(0, 5))}
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          placeholder="—"
        />
      </div>
    );
  }

  // Edit mode: time input
  return (
    <div className="px-2 py-1">
      <input
        type="time"
        value={value || ""}
        onChange={(e) => onChange(e.target.value.slice(0, 5))}
        className="w-full bg-transparent text-sm outline-none"
      />
    </div>
  );
}

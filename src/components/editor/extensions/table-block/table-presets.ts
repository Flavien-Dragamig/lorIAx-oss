export interface TablePreset {
  key: string;
  label: string;
  exclusiveWith?: string; // mutually exclusive preset key
}

export const TABLE_PRESETS: TablePreset[] = [
  { key: "header", label: "En-tête mis en avant" },
  { key: "striped", label: "Lignes alternées" },
  { key: "bordered", label: "Bordures complètes", exclusiveWith: "minimal" },
  { key: "minimal", label: "Sans bordure", exclusiveWith: "bordered" },
  { key: "col-accent", label: "Première colonne en gras" },
  { key: "compact", label: "Compact", exclusiveWith: "spacious" },
  { key: "spacious", label: "Aéré", exclusiveWith: "compact" },
];

export function parsePresets(value: string | null | undefined): string[] {
  if (!value || value === "default") return [];
  return value.split(",").filter(Boolean);
}

export function serializePresets(presets: string[]): string {
  return presets.length > 0 ? presets.join(",") : "default";
}

export function togglePreset(current: string[], key: string): string[] {
  const preset = TABLE_PRESETS.find((p) => p.key === key);
  if (!preset) return current;

  if (current.includes(key)) {
    // Remove it
    return current.filter((k) => k !== key);
  }

  // Add it, remove mutually exclusive preset if any
  let next = [...current, key];
  if (preset.exclusiveWith) {
    next = next.filter((k) => k !== preset.exclusiveWith);
  }
  return next;
}

export function presetClasses(presets: string[]): string {
  return presets.map((p) => `table-preset-${p}`).join(" ");
}

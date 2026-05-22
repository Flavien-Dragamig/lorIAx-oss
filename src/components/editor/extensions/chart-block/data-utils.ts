import type { ChartDataRow } from "./types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function parseImportedData(raw: Record<string, string>[]): { data: ChartDataRow[]; columns: string[]; labelKey: string } {
  if (raw.length === 0) return { data: [], columns: [], labelKey: "label" };
  const allKeys = Object.keys(raw[0]);
  // First column is the label, rest are numeric values
  const labelKey = allKeys[0];
  const valueKeys = allKeys.slice(1);
  const data = raw.map((row) => {
    const out: ChartDataRow = { [labelKey]: row[labelKey] };
    for (const k of valueKeys) {
      const n = parseFloat(String(row[k]).replace(",", "."));
      out[k] = isNaN(n) ? 0 : n;
    }
    return out;
  });
  return { data, columns: allKeys, labelKey };
}

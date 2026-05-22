import type { ChartDataRow, DataSourceConfig } from "./types";
import { parseImportedData } from "./data-utils";

export async function fetchDataFromSource(
  ds: DataSourceConfig
): Promise<{ data: ChartDataRow[]; columns: string[]; labelKey: string } | null> {
  if (ds.type === "manual" || !ds.url) return null;

  const res = await fetch("/api/data-proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: ds.type, url: ds.url, jsonPath: ds.jsonPath, gid: ds.gid }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Erreur de synchronisation");
  }

  const result = await res.json();

  if (ds.type === "google-sheets" && result.csv) {
    const Papa = (await import("papaparse")).default;
    const parsed = Papa.parse(result.csv, { header: true, skipEmptyLines: true });
    return parseImportedData(parsed.data as Record<string, string>[]);
  }

  if (result.data && Array.isArray(result.data)) {
    return parseImportedData(result.data as Record<string, string>[]);
  }

  return null;
}

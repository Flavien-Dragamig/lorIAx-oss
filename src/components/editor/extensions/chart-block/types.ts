// ─── Types ───────────────────────────────────────────────────────────────────

export type ChartType = "bar" | "line" | "pie" | "area";

export interface ChartDataRow {
  [key: string]: string | number;
}

export interface ChartConfig {
  chartType: ChartType;
  title: string;
  data: ChartDataRow[];
  columns: string[];
  labelKey: string;
  colors: string[];
}

export interface DataSourceConfig {
  type: "manual" | "rest-api" | "google-sheets";
  url?: string;
  jsonPath?: string;
  gid?: string;
  refreshInterval?: number; // minutes, 0 = manual only
  lastFetched?: string; // ISO date
}

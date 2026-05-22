// ─── Types ───────────────────────────────────────────────────────────────────

export type ColumnType = "text" | "number" | "date" | "select" | "checkbox" | "relation" | "image" | "formula" | "url" | "email" | "attachment" | "time";

// ARCH-03 — Types stricts pour les configurations de colonnes
export interface ColumnConfig {
  options?: string[];
  targetDatabaseId?: string;
  unit?: string;
  formula?: string;
  multiple?: boolean;
  width?: number;
  [key: string]: unknown;
}

// ARCH-03 — Types stricts pour les cellules
export type CellValue = string | number | boolean | string[] | null;

export interface DbColumn {
  id: string;
  databaseId: string;
  name: string;
  type: ColumnType;
  position: number;
  config: ColumnConfig;
  createdAt: string;
}

export interface DbRow {
  id: string;
  databaseId: string;
  cells: Record<string, CellValue>;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface DbData {
  id: string;
  spaceId: string;
  name: string;
  description: string | null;
  columns: DbColumn[];
  rows: DbRow[];
}

export interface DbListItem {
  id: string;
  name: string;
  spaceId: string;
}

export type ViewMode = "table" | "kanban" | "gallery";

export interface SortConfig {
  columnId: string;
  direction: "asc" | "desc";
}

export interface FilterConfig {
  columnId: string;
  value: string;
}

export interface SyncMapping {
  id: string;
  provider: string;
  externalId: string;
  syncMode: string;
  syncIntervalMin: number | null;
  isSyncing: boolean;
  syncError: string | null;
  lastSyncAt: string | null;
  lastSyncDirection: string | null;
  columnMapping: unknown;
  logs: { id: string; direction: string; status: string; rowsCreated: number; rowsUpdated: number; rowsDeleted: number; startedAt: string }[];
}

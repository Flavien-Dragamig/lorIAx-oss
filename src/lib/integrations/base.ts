/**
 * Types et interfaces abstraites pour les intégrations externes.
 */

export type SyncProvider = "airtable" | "notion";
export type SyncDirection = "pull" | "push";
export type SyncMode = "manual" | "pull" | "bidirectional";

export interface ExternalColumn {
  externalId: string;
  name: string;
  type: string; // type natif du provider
  loriaxType: "text" | "number" | "date" | "select" | "checkbox" | "relation" | "image" | "formula" | "url" | "email" | "attachment" | "time";
  options?: string[]; // pour les colonnes select
  config?: { multiple?: boolean };
}

export interface ExternalRow {
  externalId: string;
  cells: Record<string, unknown>;
  lastModified?: string; // ISO date
}

export interface ColumnMapping {
  loriaxColumnId: string;
  externalColumnId: string;
  direction: "both" | "pull-only" | "push-only";
}

export interface SyncResult {
  rowsCreated: number;
  rowsUpdated: number;
  rowsDeleted: number;
  errors: string[];
}

export interface ExternalProvider {
  /** Récupérer le schéma (colonnes) de la source externe */
  fetchSchema(externalId: string, credentials: string): Promise<ExternalColumn[]>;

  /** Récupérer toutes les lignes de la source externe */
  fetchRows(externalId: string, credentials: string): Promise<ExternalRow[]>;

  /** Créer des lignes dans la source externe */
  createRows(
    externalId: string,
    credentials: string,
    rows: { cells: Record<string, unknown> }[]
  ): Promise<{ externalId: string }[]>;

  /** Mettre à jour des lignes dans la source externe */
  updateRows(
    externalId: string,
    credentials: string,
    rows: { externalRowId: string; cells: Record<string, unknown> }[]
  ): Promise<void>;

  /** Supprimer des lignes dans la source externe */
  deleteRows(
    externalId: string,
    credentials: string,
    externalRowIds: string[]
  ): Promise<void>;
}

/** Hash simple d'un objet pour détecter les changements */
export function contentHash(cells: Record<string, unknown>): string {
  const sorted = JSON.stringify(cells, Object.keys(cells).sort());
  let hash = 0;
  for (let i = 0; i < sorted.length; i++) {
    const char = sorted.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(36).padStart(8, "0");
}

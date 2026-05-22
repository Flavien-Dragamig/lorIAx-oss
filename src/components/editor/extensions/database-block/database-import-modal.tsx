"use client";

import { useState, useRef } from "react";
import { X, Upload } from "lucide-react";
import { toast } from "sonner";
import type { ColumnType, CellValue, DbColumn, DbData } from "./types";
import { fetchJson, apiPost } from "./api";
import { COLUMN_TYPE_LABELS } from "./constants";

// ─── CSV helpers ─────────────────────────────────────────────────────────────

function detectColumnType(values: string[]): ColumnType {
  const nonEmpty = values.filter((v) => v.trim() !== "");
  if (nonEmpty.length === 0) return "text";

  const allNumbers = nonEmpty.every((v) => !isNaN(Number(v)));
  if (allNumbers) return "number";

  const datePattern = /^\d{4}-\d{2}-\d{2}|^\d{2}\/\d{2}\/\d{4}/;
  const allDates = nonEmpty.every((v) => datePattern.test(v));
  if (allDates) return "date";

  const allBool = nonEmpty.every((v) =>
    ["true", "false", "oui", "non", "yes", "no", "1", "0"].includes(v.toLowerCase())
  );
  if (allBool) return "checkbox";

  return "text";
}

function parseCsvValue(value: string, type: ColumnType): CellValue {
  if (value === "" || value == null) return null;
  switch (type) {
    case "number":
      return Number(value) || null;
    case "checkbox":
      return ["true", "oui", "yes", "1"].includes(value.toLowerCase());
    case "date":
      return value;
    default:
      return value;
  }
}

export async function exportCsv(data: DbData) {
  const Papa = (await import("papaparse")).default;
  const headers = data.columns.map((c) => c.name);
  const rows = data.rows.map((row) =>
    data.columns.map((col) => {
      const val = row.cells?.[col.id];
      if (val == null) return "";
      if (typeof val === "boolean") return val ? "Oui" : "Non";
      if (Array.isArray(val)) return val.join(", ");
      return String(val);
    })
  );

  const csv = Papa.unparse({ fields: headers, data: rows });
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${data.name || "export"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── CSV Import Modal ────────────────────────────────────────────────────────

export function CsvImportModal({
  databaseId,
  existingColumns,
  onComplete,
  onClose,
}: {
  databaseId: string;
  existingColumns: DbColumn[];
  onComplete: () => void;
  onClose: () => void;
}) {
  const [csvData, setCsvData] = useState<string[][] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<number, string>>({});
  const [importing, setImporting] = useState(false);
  const [hasHeader, setHasHeader] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const Papa = (await import("papaparse")).default;
      const result = Papa.parse(text, { skipEmptyLines: true });
      const rows = result.data as string[][];
      if (rows.length === 0) return;

      if (hasHeader) {
        setHeaders(rows[0]);
        setCsvData(rows.slice(1));
      } else {
        setHeaders(rows[0].map((_, i) => `Colonne ${i + 1}`));
        setCsvData(rows);
      }

      // Auto-map to existing columns by name
      const mapping: Record<number, string> = {};
      const firstRow = hasHeader ? rows[0] : [];
      firstRow.forEach((header, i) => {
        const match = existingColumns.find(
          (c) => c.name.toLowerCase() === header.toLowerCase()
        );
        if (match) mapping[i] = match.id;
      });
      setColumnMapping(mapping);
    };
    reader.readAsText(file);
  }

  async function doImport() {
    if (!csvData) return;
    setImporting(true);

    try {
      // Create new columns for unmapped CSV columns
      const newColumnIds: Record<number, string> = { ...columnMapping };
      const colValues: Record<number, string[]> = {};

      headers.forEach((_, i) => {
        colValues[i] = csvData.map((row) => row[i] ?? "");
      });

      for (let i = 0; i < headers.length; i++) {
        if (!newColumnIds[i]) {
          const type = detectColumnType(colValues[i]);
          const col = await apiPost<DbColumn>(`/api/databases/${databaseId}/columns`, {
            name: headers[i],
            type,
          });
          newColumnIds[i] = col.id;
        }
      }

      // Refresh to get updated columns
      const updatedDb = await fetchJson<DbData>(`/api/databases/${databaseId}`);
      const colMap = new Map(updatedDb.columns.map((c) => [c.id, c]));

      // Create rows in batches
      const batchSize = 50;
      for (let b = 0; b < csvData.length; b += batchSize) {
        const batch = csvData.slice(b, b + batchSize);
        await Promise.all(
          batch.map((row) => {
            const cells: Record<string, CellValue> = {};
            headers.forEach((_, i) => {
              const colId = newColumnIds[i];
              const col = colMap.get(colId);
              if (colId && col) {
                cells[colId] = parseCsvValue(row[i] ?? "", col.type);
              }
            });
            return apiPost(`/api/databases/${databaseId}/rows`, { cells });
          })
        );
      }

      toast.success(`${csvData.length} lignes importées`);
      onComplete();
    } catch (err) {
      console.error("Import error:", err);
      toast.error("Erreur lors de l'import");
    }
    setImporting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-lg shadow-xl w-[600px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Importer un fichier CSV</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 flex-1 overflow-auto">
          {/* File picker */}
          {!csvData && (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={hasHeader}
                  onChange={(e) => setHasHeader(e.target.checked)}
                  className="rounded"
                />
                La première ligne contient les en-têtes
              </label>
              <div
                className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Cliquez pour sélectionner un fichier CSV
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.tsv,.txt"
                  onChange={handleFile}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {/* Preview */}
          {csvData && (
            <>
              <p className="text-sm text-muted-foreground">
                {csvData.length} ligne{csvData.length > 1 ? "s" : ""} trouvée{csvData.length > 1 ? "s" : ""}
              </p>

              {/* Column mapping */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Association des colonnes
                </p>
                {headers.map((header, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-32 truncate font-mono text-xs bg-muted px-2 py-1 rounded">
                      {header}
                    </span>
                    <span className="text-muted-foreground">{"\u2192"}</span>
                    <select
                      value={columnMapping[i] || ""}
                      onChange={(e) =>
                        setColumnMapping((prev) => ({ ...prev, [i]: e.target.value }))
                      }
                      className="flex-1 text-xs px-2 py-1.5 rounded border bg-background"
                    >
                      <option value="">Nouvelle colonne</option>
                      {existingColumns.map((col) => (
                        <option key={col.id} value={col.id}>
                          {col.name} ({COLUMN_TYPE_LABELS[col.type]})
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Data preview */}
              <div className="border rounded overflow-auto max-h-40">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="bg-muted">
                      {headers.map((h, i) => (
                        <th key={i} className="px-2 py-1 text-left font-medium border-r border-border last:border-r-0">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-t border-border">
                        {row.map((cell, j) => (
                          <td key={j} className="px-2 py-1 border-r border-border last:border-r-0 truncate max-w-32">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {csvData.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center py-1 bg-muted/50">
                    ... et {csvData.length - 5} autres lignes
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {csvData && (
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
            <button
              onClick={() => { setCsvData(null); setHeaders([]); }}
              className="text-sm px-3 py-1.5 rounded hover:bg-accent"
            >
              Changer de fichier
            </button>
            <button
              onClick={doImport}
              disabled={importing}
              className="text-sm px-4 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {importing ? "Import en cours..." : `Importer ${csvData.length} lignes`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

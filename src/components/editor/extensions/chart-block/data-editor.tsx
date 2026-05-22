"use client";

import { useRef } from "react";
import {
  Upload,
  Trash2,
  Plus,
  X,
  Check,
  RefreshCw,
} from "lucide-react";
import type Papa from "papaparse";
import type { ChartConfig, DataSourceConfig, ChartDataRow } from "./types";
import { CHART_TYPE_OPTIONS, DATA_SOURCE_OPTIONS } from "./constants";
import { parseImportedData } from "./data-utils";

// ─── Data Editor ─────────────────────────────────────────────────────────────

export function DataEditor({
  config,
  onChange,
  onClose,
  dataSource,
  onDataSourceChange,
  onSync,
  syncing,
}: {
  config: ChartConfig;
  onChange: (cfg: Partial<ChartConfig>) => void;
  onClose: () => void;
  dataSource: DataSourceConfig;
  onDataSourceChange: (ds: DataSourceConfig) => void;
  onSync: () => void;
  syncing: boolean;
}) {
  const { data, columns, labelKey, chartType, title } = config;
  const fileInputRef = useRef<HTMLInputElement>(null);

  function updateCell(rowIndex: number, col: string, value: string) {
    const newData = [...data];
    newData[rowIndex] = {
      ...newData[rowIndex],
      [col]: col === labelKey ? value : (parseFloat(value.replace(",", ".")) || 0),
    };
    onChange({ data: newData });
  }

  function addRow() {
    const newRow: ChartDataRow = {};
    for (const col of columns) {
      newRow[col] = col === labelKey ? "" : 0;
    }
    onChange({ data: [...data, newRow] });
  }

  function removeRow(index: number) {
    onChange({ data: data.filter((_, i) => i !== index) });
  }

  function addColumn() {
    const name = `col${columns.length}`;
    const newColumns = [...columns, name];
    const newData = data.map((row) => ({ ...row, [name]: 0 }));
    onChange({ columns: newColumns, data: newData });
  }

  function removeColumn(col: string) {
    if (col === labelKey || columns.length <= 2) return;
    const newColumns = columns.filter((c) => c !== col);
    const newData = data.map((row) => {
      const newRow = { ...row };
      delete newRow[col];
      return newRow;
    });
    onChange({ columns: newColumns, data: newData });
  }

  function renameColumn(oldName: string, newName: string) {
    if (!newName.trim() || newName === oldName) return;
    const trimmed = newName.trim();
    const newColumns = columns.map((c) => (c === oldName ? trimmed : c));
    const newData = data.map((row) => {
      const newRow: ChartDataRow = {};
      for (const [k, v] of Object.entries(row)) {
        newRow[k === oldName ? trimmed : k] = v;
      }
      return newRow;
    });
    onChange({
      columns: newColumns,
      data: newData,
      labelKey: labelKey === oldName ? trimmed : labelKey,
    });
  }

  function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "csv" || ext === "tsv") {
      import("papaparse").then((Papa) => {
        Papa.default.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results: Papa.ParseResult<Record<string, string>>) => {
            const parsed = parseImportedData(results.data);
            onChange(parsed);
          },
        });
      });
    } else if (ext === "xlsx" || ext === "xls" || ext === "ods") {
      import("exceljs").then((ExcelJS) => {
        const reader = new FileReader();
        reader.onload = async (evt) => {
          const buffer = evt.target?.result as ArrayBuffer;
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(buffer);
          const worksheet = workbook.worksheets[0];
          if (!worksheet) return;

          // Extraire les en-têtes (première ligne)
          const headers: string[] = [];
          worksheet.getRow(1).eachCell((cell, colNumber) => {
            headers[colNumber - 1] = String(cell.value ?? `col${colNumber}`);
          });

          // Extraire les données
          const raw: Record<string, string>[] = [];
          worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // skip header
            const obj: Record<string, string> = {};
            row.eachCell((cell, colNumber) => {
              const key = headers[colNumber - 1] || `col${colNumber}`;
              obj[key] = String(cell.value ?? "");
            });
            // Remplir les colonnes manquantes
            for (const h of headers) {
              if (!(h in obj)) obj[h] = "";
            }
            raw.push(obj);
          });

          const parsed = parseImportedData(raw);
          onChange(parsed);
        };
        reader.readAsArrayBuffer(file);
      });
    }

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="chart-block-editor">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <input
          type="text"
          value={title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Titre du graphique"
          className="flex-1 px-2 py-1 text-sm rounded border border-input bg-background"
        />
        <button onClick={onClose} className="p-1.5 rounded hover:bg-accent" title="Fermer l'éditeur">
          <Check className="h-4 w-4" />
        </button>
      </div>

      {/* Type selector */}
      <div className="flex gap-1 mb-3">
        {CHART_TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange({ chartType: opt.value })}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
              chartType === opt.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-accent"
            }`}
          >
            {opt.icon}
            {opt.label}
          </button>
        ))}
      </div>

      {/* Source de données */}
      <div className="mb-3">
        <div className="text-xs font-medium text-muted-foreground mb-1.5">Source de données</div>
        <div className="flex gap-1 mb-2">
          {DATA_SOURCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onDataSourceChange({ ...dataSource, type: opt.value })}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                dataSource.type === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-accent"
              }`}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>

        {dataSource.type === "rest-api" && (
          <div className="space-y-2 mb-2 p-2.5 rounded border border-border bg-muted/30">
            <div>
              <label className="text-xs text-muted-foreground">URL de l&apos;API</label>
              <input
                type="url"
                value={dataSource.url || ""}
                onChange={(e) => onDataSourceChange({ ...dataSource, url: e.target.value })}
                placeholder="https://api.exemple.com/data"
                className="w-full px-2 py-1 text-xs rounded border border-input bg-background mt-0.5"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Chemin JSON (optionnel)</label>
              <input
                type="text"
                value={dataSource.jsonPath || ""}
                onChange={(e) => onDataSourceChange({ ...dataSource, jsonPath: e.target.value })}
                placeholder="data.results"
                className="w-full px-2 py-1 text-xs rounded border border-input bg-background mt-0.5"
              />
              <span className="text-[10px] text-muted-foreground">Chemin vers le tableau dans la réponse JSON</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-xs text-muted-foreground shrink-0">Actualisation</label>
              <select
                value={dataSource.refreshInterval || 0}
                onChange={(e) => onDataSourceChange({ ...dataSource, refreshInterval: parseInt(e.target.value) })}
                className="px-2 py-1 text-xs rounded border border-input bg-background"
              >
                <option value={0}>Manuelle</option>
                <option value={1}>1 min</option>
                <option value={5}>5 min</option>
                <option value={15}>15 min</option>
                <option value={60}>1 heure</option>
              </select>
              <button
                onClick={onSync}
                disabled={syncing || !dataSource.url}
                className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
                Synchroniser
              </button>
            </div>
            {dataSource.lastFetched && (
              <div className="text-[10px] text-muted-foreground">
                Dernière sync : {new Date(dataSource.lastFetched).toLocaleString("fr-FR")}
              </div>
            )}
          </div>
        )}

        {dataSource.type === "google-sheets" && (
          <div className="space-y-2 mb-2 p-2.5 rounded border border-border bg-muted/30">
            <div>
              <label className="text-xs text-muted-foreground">URL Google Sheets</label>
              <input
                type="url"
                value={dataSource.url || ""}
                onChange={(e) => {
                  const newUrl = e.target.value;
                  const gidMatch = newUrl.match(/#gid=(\d+)/);
                  onDataSourceChange({
                    ...dataSource,
                    url: newUrl,
                    ...(gidMatch ? { gid: gidMatch[1] } : {}),
                  });
                }}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="w-full px-2 py-1 text-xs rounded border border-input bg-background mt-0.5"
              />
              <span className="text-[10px] text-muted-foreground">La feuille doit être partagée publiquement</span>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">N° feuille (GID)</label>
              <input
                type="text"
                value={dataSource.gid || "0"}
                onChange={(e) => onDataSourceChange({ ...dataSource, gid: e.target.value })}
                placeholder="0"
                className="w-20 px-2 py-1 text-xs rounded border border-input bg-background mt-0.5"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-xs text-muted-foreground shrink-0">Actualisation</label>
              <select
                value={dataSource.refreshInterval || 0}
                onChange={(e) => onDataSourceChange({ ...dataSource, refreshInterval: parseInt(e.target.value) })}
                className="px-2 py-1 text-xs rounded border border-input bg-background"
              >
                <option value={0}>Manuelle</option>
                <option value={1}>1 min</option>
                <option value={5}>5 min</option>
                <option value={15}>15 min</option>
                <option value={60}>1 heure</option>
              </select>
              <button
                onClick={onSync}
                disabled={syncing || !dataSource.url}
                className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
                Synchroniser
              </button>
            </div>
            {dataSource.lastFetched && (
              <div className="text-[10px] text-muted-foreground">
                Dernière sync : {new Date(dataSource.lastFetched).toLocaleString("fr-FR")}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Import button — uniquement en mode manuel */}
      {dataSource.type === "manual" && (
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium bg-muted hover:bg-accent transition-colors"
        >
          <Upload className="h-3.5 w-3.5" />
          Importer (CSV, XLSX, ODS)
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.tsv,.xlsx,.xls,.ods"
          onChange={handleFileImport}
          className="hidden"
        />
      </div>
      )}

      {/* Data table */}
      <div className="overflow-x-auto rounded border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50">
              {columns.map((col) => (
                <th key={col} className="px-2 py-1.5 text-left font-medium relative group">
                  <input
                    type="text"
                    value={col}
                    onChange={(e) => renameColumn(col, e.target.value)}
                    className="w-full bg-transparent border-none text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary rounded px-1"
                  />
                  {col !== labelKey && columns.length > 2 && (
                    <button
                      onClick={() => removeColumn(col)}
                      className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 p-0.5 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </th>
              ))}
              <th className="px-1 py-1.5 w-16">
                <button onClick={addColumn} className="p-1 rounded hover:bg-accent" title="Ajouter une colonne">
                  <Plus className="h-3 w-3" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, ri) => (
              <tr key={ri} className="border-t border-border hover:bg-muted/30 group">
                {columns.map((col) => (
                  <td key={col} className="px-1 py-0.5">
                    <input
                      type={col === labelKey ? "text" : "number"}
                      value={row[col] ?? ""}
                      onChange={(e) => updateCell(ri, col, e.target.value)}
                      className="w-full px-1 py-0.5 text-xs bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary rounded"
                    />
                  </td>
                ))}
                <td className="px-1 py-0.5">
                  <button
                    onClick={() => removeRow(ri)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-opacity"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={addRow}
        className="mt-2 flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:bg-accent transition-colors"
      >
        <Plus className="h-3 w-3" />
        Ajouter une ligne
      </button>
    </div>
  );
}

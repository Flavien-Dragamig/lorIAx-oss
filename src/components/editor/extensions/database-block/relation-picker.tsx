"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Plus, X, Search, Link2 } from "lucide-react";
import type { DbRow, DbColumn } from "./types";

// ─── Relation helpers ────────────────────────────────────────────────────────

export function getRowDisplayName(row: DbRow, targetColumns?: DbColumn[]): string {
  const cells = row.cells ?? {};

  // Priorite : premiere colonne par position (celle visible par l'usager)
  if (targetColumns && targetColumns.length > 0) {
    for (const col of targetColumns) {
      const val = cells[col.id];
      if (val != null && val !== "") return String(val);
    }
  }

  // Fallback : premiere valeur non vide dans les cellules
  for (const val of Object.values(cells)) {
    if (val != null && val !== "" && typeof val !== "boolean" && !Array.isArray(val)) {
      return String(val);
    }
  }

  return `Ligne ${row.position + 1}`;
}

// ─── Relation Picker ─────────────────────────────────────────────────────────

export function RelationPicker({
  selected,
  targetRows,
  targetColumns,
  onChange,
}: {
  selected: string[];
  targetRows: DbRow[];
  targetColumns?: DbColumn[];
  onChange: (val: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as globalThis.Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const available = useMemo(() => {
    const sel = new Set(selected);
    return targetRows
      .filter((r) => !sel.has(r.id))
      .filter((r) => {
        if (!search) return true;
        const name = getRowDisplayName(r, targetColumns).toLowerCase();
        return name.includes(search.toLowerCase());
      });
  }, [targetRows, selected, search, targetColumns]);

  return (
    <div className="relative" ref={pickerRef}>
      <div className="flex flex-wrap gap-1 p-1 min-h-[32px] items-center">
        {selected.map((rowId) => {
          const row = targetRows.find((r) => r.id === rowId);
          const label = row
            ? getRowDisplayName(row, targetColumns)
            : "...";
          return (
            <span
              key={rowId}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-accent text-accent-foreground"
            >
              {label}
              <button
                onClick={() => onChange(selected.filter((id) => id !== rowId))}
                className="hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
        <button
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-56 rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="p-2 border-b">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded border bg-background">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="flex-1 text-xs bg-transparent outline-none"
              />
            </div>
          </div>
          <div className="max-h-40 overflow-y-auto p-1">
            {available.length === 0 && (
              <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                {targetRows.length === 0 ? "Aucune ligne dans la base cible" : "Aucun résultat"}
              </div>
            )}
            {available.map((row) => (
              <button
                key={row.id}
                onClick={() => {
                  onChange([...selected, row.id]);
                  setSearch("");
                }}
                className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-accent transition-colors flex items-center gap-1.5"
              >
                <Link2 className="h-3 w-3 text-muted-foreground shrink-0" />
                {getRowDisplayName(row, targetColumns)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

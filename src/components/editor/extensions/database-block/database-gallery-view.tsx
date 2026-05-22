"use client";

import type { DbData, DbColumn, DbRow } from "./types";

// ─── Gallery View ────────────────────────────────────────────────────────────

export function GalleryView({
  data: _data,
  columns,
  rows,
}: {
  data: DbData;
  columns: DbColumn[];
  rows: DbRow[];
}) {
  const titleColumn = columns.find((c) => c.type === "text") || columns[0];
  const imageCol = columns.find((c) => c.type === "image");

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3">
      {rows.map((row) => {
        const coverUrl = imageCol ? row.cells?.[imageCol.id] : null;
        const hasCover = coverUrl && typeof coverUrl === "string";

        return (
          <div
            key={row.id}
            className="bg-card border border-border rounded-lg overflow-hidden hover:border-primary/30 transition-colors"
          >
            {hasCover && (
              <div className="w-full h-32 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            )}
            <div className="p-3 space-y-1.5">
              {titleColumn && (
                <p className="text-sm font-medium truncate">
                  {row.cells?.[titleColumn.id] || `Ligne ${row.position + 1}`}
                </p>
              )}
              {columns
                .filter((c) => c.id !== titleColumn?.id && c.id !== imageCol?.id)
                .slice(0, 3)
                .map((col) => {
                  const val = row.cells?.[col.id];
                  if (val == null || val === "") return null;
                  return (
                    <div key={col.id} className="text-xs text-muted-foreground">
                      <span className="font-medium">{col.name}:</span>{" "}
                      {col.type === "checkbox" ? (val ? "Oui" : "Non") : String(val)}
                    </div>
                  );
                })}
            </div>
          </div>
        );
      })}
      {rows.length === 0 && (
        <div className="col-span-full text-sm text-muted-foreground text-center py-8">
          Aucune donnée
        </div>
      )}
    </div>
  );
}

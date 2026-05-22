"use client";

import { useState, useEffect, useRef } from "react";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { DbData, ViewMode, ColumnConfig } from "./types";
import { COLUMN_TYPE_ICONS } from "./constants";
import { CellEditor } from "./database-cell-editor";
import { ColumnHeaderMenu, AddColumnMenu } from "./database-column-header";
import { KanbanView } from "./database-kanban-view";
import { GalleryView } from "./database-gallery-view";
import { DatabaseToolbar } from "./database-toolbar";
import { CsvImportModal } from "./database-import-modal";
import { useDatabaseData } from "./use-database-data";
import { evaluateFormula } from "./formula-evaluator";
import { apiPatch } from "./api";

// ─── Database Table ──────────────────────────────────────────────────────────

export function DatabaseTable({
  data,
  spaceId,
  onRefresh,
  viewMode,
  onViewModeChange,
}: {
  data: DbData;
  spaceId: string;
  onRefresh: () => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}) {
  const {
    columns,
    allDatabases,
    relationData,
    sort,
    filters,
    showFilters,
    setShowFilters,
    showImport,
    setShowImport,
    updateCell,
    addRow,
    deleteRow,
    addColumn,
    updateColumn,
    deleteColumn,
    toggleSort,
    updateFilter,
    setFilters,
    filteredRows,
    rows,
  } = useDatabaseData(data, spaceId, onRefresh);

  const [resizing, setResizing] = useState<{ colId: string; startX: number; startWidth: number } | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Virtualisation activée au-delà de 50 lignes
  const useVirtual = filteredRows.length > 50;
  const ROW_HEIGHT = 36;

  const virtualizer = useVirtualizer({
    count: filteredRows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    enabled: useVirtual,
  });

  useEffect(() => {
    if (!resizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - resizing.startX;
      const newWidth = Math.max(60, resizing.startWidth + diff);
      const th = document.querySelector(`[data-col-id="${resizing.colId}"]`) as HTMLElement;
      if (th) th.style.width = `${newWidth}px`;
    };
    const handleMouseUp = (e: MouseEvent) => {
      const diff = e.clientX - resizing.startX;
      const newWidth = Math.max(60, resizing.startWidth + diff);
      const col = columns.find((c) => c.id === resizing.colId);
      if (col) {
        apiPatch(`/api/databases/${data.id}/columns`, {
          columns: [{ id: resizing.colId, config: { ...col.config, width: newWidth } }],
        }).catch(() => {});
      }
      setResizing(null);
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizing, columns, data.id]);

  return (
    <div className="database-block-table-wrapper">
      {/* View / Filter / Import-Export controls */}
      <DatabaseToolbar
        data={data}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        filtersCount={filters.length}
        onShowImport={() => setShowImport(true)}
        onRefresh={onRefresh}
      />

      {/* Filter inputs */}
      {showFilters && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/20 flex-wrap" onKeyDown={(e) => e.stopPropagation()}>
          {columns.map((col) => {
            const filterVal = filters.find((f) => f.columnId === col.id)?.value ?? "";
            return (
              <div key={col.id} className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">{col.name}:</span>
                <input
                  value={filterVal}
                  onChange={(e) => updateFilter(col.id, e.target.value)}
                  onMouseDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
                  placeholder="Filtrer..."
                  className="text-xs px-1.5 py-0.5 rounded border bg-background w-24"
                />
              </div>
            );
          })}
          {filters.length > 0 && (
            <button
              onClick={() => setFilters([])}
              className="text-xs text-destructive hover:underline ml-auto"
            >
              Effacer
            </button>
          )}
        </div>
      )}

      {/* Table view */}
      {viewMode === "table" && (
        <>
          <div
            ref={tableContainerRef}
            className={useVirtual ? "overflow-auto max-h-[600px]" : ""}
          >
            <table className="database-block-table">
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.id}
                      data-col-id={col.id}
                      className="database-block-th group/col"
                      style={{ width: col.config?.width ? `${col.config.width}px` : col.type === "image" ? "80px" : "200px" }}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">{COLUMN_TYPE_ICONS[col.type]}</span>
                        <button
                          className="truncate hover:underline"
                          onClick={() => toggleSort(col.id)}
                          title="Trier"
                        >
                          {col.name}
                        </button>
                        {sort?.columnId === col.id && (
                          sort.direction === "asc"
                            ? <ArrowUp className="h-3 w-3 text-primary shrink-0" />
                            : <ArrowDown className="h-3 w-3 text-primary shrink-0" />
                        )}
                        <ColumnHeaderMenu
                          column={col}
                          onRename={(name) => updateColumn(col.id, { name })}
                          onChangeType={(type) => updateColumn(col.id, { type })}
                          onDelete={() => deleteColumn(col.id)}
                          onUpdateConfig={(config) => updateColumn(col.id, { config: config as ColumnConfig })}
                          allDatabases={allDatabases}
                          currentDatabaseId={data.id}
                        />
                      </div>
                      <div
                        className="database-col-resize-handle"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const th = e.currentTarget.parentElement;
                          setResizing({ colId: col.id, startX: e.clientX, startWidth: th?.offsetWidth ?? 200 });
                        }}
                      />
                    </th>
                  ))}
                  <th className="database-block-th w-10">
                    <AddColumnMenu
                      onAdd={addColumn}
                      allDatabases={allDatabases}
                      currentDatabaseId={data.id}
                    />
                  </th>
                </tr>
              </thead>
              <tbody style={useVirtual ? { height: virtualizer.getTotalSize(), position: "relative" } : undefined}>
                {useVirtual
                  ? virtualizer.getVirtualItems().map((virtualRow) => {
                      const row = filteredRows[virtualRow.index];
                      return (
                        <tr
                          key={row.id}
                          className="database-block-tr group/row"
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: ROW_HEIGHT,
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                          {columns.map((col) => {
                            const cellValue = col.type === "formula" && col.config?.formula
                              ? evaluateFormula(col.config.formula as string, row, columns)
                              : row.cells?.[col.id];
                            return (
                              <td
                                key={col.id}
                                className="database-block-td"
                                onMouseDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
                                onPointerDown={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                              >
                                <CellEditor
                                  column={col}
                                  value={cellValue}
                                  onChange={(val) => updateCell(row.id, col.id, val)}
                                  allDatabases={allDatabases}
                                  relationData={relationData}
                                  spaceId={data.spaceId}
                                />
                              </td>
                            );
                          })}
                          <td className="database-block-td w-10">
                            <button
                              onClick={() => deleteRow(row.id)}
                              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-destructive opacity-0 group-hover/row:opacity-100 transition-opacity"
                              aria-label="Supprimer la ligne"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  : filteredRows.map((row) => (
                      <tr key={row.id} className="database-block-tr group/row">
                        {columns.map((col) => {
                          const cellValue = col.type === "formula" && col.config?.formula
                            ? evaluateFormula(col.config.formula as string, row, columns)
                            : row.cells?.[col.id];
                          return (
                            <td
                              key={col.id}
                              className="database-block-td"
                              onMouseDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
                              onPointerDown={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                            >
                              <CellEditor
                                column={col}
                                value={cellValue}
                                onChange={(val) => updateCell(row.id, col.id, val)}
                                allDatabases={allDatabases}
                                relationData={relationData}
                                spaceId={data.spaceId}
                              />
                            </td>
                          );
                        })}
                        <td className="database-block-td w-10">
                          <button
                            onClick={() => deleteRow(row.id)}
                            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-destructive opacity-0 group-hover/row:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={addRow}
            className="database-block-add-row"
          >
            <Plus className="h-3.5 w-3.5" />
            Nouvelle ligne
          </button>
        </>
      )}

      {/* Kanban view */}
      {viewMode === "kanban" && (
        <KanbanView
          data={data}
          columns={columns}
          rows={filteredRows}
          onCellUpdate={updateCell}
        />
      )}

      {/* Gallery view */}
      {viewMode === "gallery" && (
        <GalleryView
          data={data}
          columns={columns}
          rows={filteredRows}
        />
      )}

      {/* Filtered count */}
      {filters.length > 0 && filteredRows.length !== rows.length && (
        <div className="px-3 py-1.5 text-xs text-muted-foreground border-t border-border">
          {filteredRows.length} / {rows.length} lignes affichées
        </div>
      )}

      {/* CSV Import Modal */}
      {showImport && (
        <CsvImportModal
          databaseId={data.id}
          existingColumns={columns}
          onComplete={() => {
            setShowImport(false);
            onRefresh();
          }}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}

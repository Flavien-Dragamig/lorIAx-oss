"use client";

import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Table2, GripHorizontal, Maximize2, Trash2, Pencil, Check, BarChart2 } from "lucide-react";
import dynamic from "next/dynamic";
import { SpreadsheetModal } from "./spreadsheet-modal";
import { extractChartData } from "./spreadsheet-utils";
import { Button } from "@/components/ui/button";

const ChartRenderer = dynamic(() => import("./chart-renderer"), { ssr: false });

export function SpreadsheetBlockView({
  node,
  updateAttributes,
  editor,
  selected,
  deleteNode,
}: NodeViewProps) {
  const { sheetId, title, rowCount, colCount, chartType, chartRange } = node.attrs;
  const [modalOpen, setModalOpen] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  const editable = editor?.isEditable;

  // Données graphique inline
  const [chartData, setChartData] = useState<{ data: Record<string, string | number>[]; columns: string[]; labelKey: string } | null>(null);

  useEffect(() => {
    if (!sheetId || !chartRange) {
      setChartData(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/spreadsheet/${sheetId}`)
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        const snapshot = body.data && typeof body.data === "object" && !Array.isArray(body.data) ? body.data : null;
        setChartData(extractChartData(snapshot, chartRange));
      })
      .catch(() => { if (!cancelled) setChartData(null); });
    return () => { cancelled = true; };
  }, [sheetId, chartRange]);

  const handleStartEditTitle = useCallback(() => {
    if (!editable) return;
    setTitleDraft(title || "");
    setEditingTitle(true);
    setTimeout(() => titleInputRef.current?.focus(), 0);
  }, [title, editable]);

  const handleSaveTitle = useCallback(() => {
    const trimmed = titleDraft.trim();
    if (trimmed) updateAttributes({ title: trimmed });
    setEditingTitle(false);
  }, [titleDraft, updateAttributes]);

  const handleOpen = useCallback(async () => {
    if (!editable) return;

    // Créer le sheetId et initialiser le tableur si nécessaire
    if (!sheetId) {
      setInitializing(true);
      const newSheetId = crypto.randomUUID();
      try {
        await fetch(`/api/spreadsheet/${newSheetId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: [] }),
        });
        updateAttributes({ sheetId: newSheetId });
      } catch {
        setInitializing(false);
        return;
      }
      setInitializing(false);
      updateAttributes({ sheetId: newSheetId });
    }

    setModalOpen(true);
  }, [editable, sheetId, updateAttributes]);

  const handleClose = useCallback(
    (updatedData?: { rowCount: number; colCount: number; chartRange?: string; chartType?: string }) => {
      if (updatedData) {
        updateAttributes({
          rowCount: updatedData.rowCount,
          colCount: updatedData.colCount,
          chartRange: updatedData.chartRange ?? chartRange,
          chartType: updatedData.chartType ?? chartType,
        });
      }
      setModalOpen(false);
    },
    [updateAttributes, chartRange, chartType]
  );

  const hasChart = chartRange && chartData && chartData.data.length > 0;
  const hasDimensions = rowCount > 0 || colCount > 0;

  return (
    <NodeViewWrapper
      data-type="spreadsheet-block"
      className={`spreadsheet-block-wrapper ${selected ? "is-selected" : ""}`}
    >
      <div className="spreadsheet-block">
        {/* Toolbar */}
        <div
          className={`spreadsheet-block-toolbar ${selected ? "is-visible" : ""}`}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span data-drag-handle className="flex items-center gap-1 shrink-0 cursor-grab">
              <GripHorizontal className="h-4 w-4 text-muted-foreground" />
            </span>
            <Table2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {editingTitle ? (
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <input
                  ref={titleInputRef}
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onMouseDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); handleSaveTitle(); }
                    if (e.key === "Escape") setEditingTitle(false);
                    e.stopPropagation();
                  }}
                  onBlur={handleSaveTitle}
                  className="flex-1 min-w-0 px-1.5 py-0.5 text-xs font-medium rounded border border-primary/40 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <Button
                  onClick={handleSaveTitle}
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Valider le titre"
                >
                  <Check className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <button
                onClick={handleStartEditTitle}
                disabled={!editable}
                className="flex items-center gap-1.5 text-xs font-medium hover:text-primary transition-colors group text-left truncate flex-1 min-w-0"
              >
                <span className="truncate">{title || "Tableur"}</span>
                {editable && (
                  <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                )}
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            {editable && (
              <Button
                onClick={handleOpen}
                disabled={initializing}
                variant="ghost"
                size="xs"
                title="Ouvrir le tableur"
                className="gap-1"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                <span className="text-[11px]">
                  {initializing ? "Initialisation..." : "Ouvrir"}
                </span>
              </Button>
            )}
            {editable && (
              <Button
                onClick={deleteNode}
                variant="ghost"
                size="icon-sm"
                title="Supprimer le bloc"
                aria-label="Supprimer le bloc tableur"
                className="hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Aperçu */}
        <div className={`spreadsheet-block-content ${hasChart ? "!p-0 !min-h-0" : ""}`}>
          {hasChart ? (
            <div className="w-full" style={{ height: 320 }}>
              <ChartRenderer
                config={{
                  chartType: chartType || "bar",
                  title: "",
                  data: chartData.data,
                  columns: chartData.columns,
                  labelKey: chartData.labelKey,
                  colors: [],
                }}
                chartRef={{ current: null }}
              />
            </div>
          ) : hasDimensions ? (
            <div className="flex flex-col items-center justify-center gap-1 text-muted-foreground/60">
              <Table2 className="h-8 w-8" />
              <span className="text-xs font-medium">
                {rowCount} ligne{rowCount > 1 ? "s" : ""} × {colCount} colonne
                {colCount > 1 ? "s" : ""}
              </span>
              <span className="text-[10px] text-muted-foreground/40">
                {title || "Tableur"}
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground/40">
              <Table2 className="h-10 w-10" />
              <span className="text-xs">
                Cliquer sur « Ouvrir » pour commencer
              </span>
            </div>
          )}
        </div>

        {/* Indicateur graphique configuré mais pas encore chargé */}
        {chartRange && !hasChart && hasDimensions && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] text-muted-foreground/50 border-t border-border">
            <BarChart2 className="h-3 w-3" />
            <span>Graphique configuré — plage {chartRange}</span>
          </div>
        )}
      </div>

      {/* Modal plein écran — portal hors du DOM TipTap */}
      {modalOpen && (sheetId || initializing) && createPortal(
        <SpreadsheetModal
          sheetId={sheetId}
          title={title || "Tableur"}
          initialChartRange={chartRange}
          initialChartType={chartType}
          onClose={handleClose}
        />,
        document.body
      )}
    </NodeViewWrapper>
  );
}

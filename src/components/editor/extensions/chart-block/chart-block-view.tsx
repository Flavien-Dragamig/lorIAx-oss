"use client";

import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/core";
import { useState, useRef, useCallback, useMemo, useEffect, Suspense, lazy } from "react";
import {
  Download,
  Pencil,
  Trash2,
  GripHorizontal,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toPng, toSvg } from "html-to-image";
import type { ChartType, ChartConfig, ChartDataRow, DataSourceConfig } from "./types";
import { DEFAULT_COLORS, DEFAULT_DATA } from "./constants";
import { fetchDataFromSource } from "./api";
import { DataEditor } from "./data-editor";

// Lazy-load du renderer Recharts (~250KB) — chargé uniquement à l'affichage d'un bloc graphique
const LazyChartRenderer = lazy(() => import("../chart-renderer"));

// ─── Node View ───────────────────────────────────────────────────────────────

export function ChartBlockView({
  node,
  updateAttributes,
  selected,
  deleteNode,
}: Pick<NodeViewProps, "node" | "updateAttributes" | "selected" | "deleteNode">) {
  const attrs = node.attrs;
  const [editing, setEditing] = useState(!attrs.data || attrs.data === "[]");
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const dataSource: DataSourceConfig = useMemo(() => {
    try {
      return typeof attrs.dataSource === "string"
        ? JSON.parse(attrs.dataSource)
        : attrs.dataSource || { type: "manual" as const };
    } catch {
      return { type: "manual" as const };
    }
  }, [attrs.dataSource]);

  const config: ChartConfig = useMemo(() => {
    let data: ChartDataRow[];
    let columns: string[];
    try {
      data = typeof attrs.data === "string" ? JSON.parse(attrs.data) : attrs.data || [];
      columns = typeof attrs.columns === "string" ? JSON.parse(attrs.columns) : attrs.columns || [];
    } catch {
      data = DEFAULT_DATA;
      columns = ["label", "valeur"];
    }
    if (data.length === 0) {
      data = DEFAULT_DATA;
      columns = ["label", "valeur"];
    }
    if (columns.length === 0 && data.length > 0) {
      columns = Object.keys(data[0]);
    }
    return {
      chartType: (attrs.chartType as ChartType) || "bar",
      title: attrs.title || "",
      data,
      columns,
      labelKey: attrs.labelKey || columns[0] || "label",
      colors: (() => { try { return typeof attrs.colors === "string" ? JSON.parse(attrs.colors) : attrs.colors || DEFAULT_COLORS; } catch { return DEFAULT_COLORS; } })(),
    };
  }, [attrs]);

  const handleChange = useCallback(
    (partial: Partial<ChartConfig>) => {
      const updated = { ...config, ...partial };
      updateAttributes({
        chartType: updated.chartType,
        title: updated.title,
        data: JSON.stringify(updated.data),
        columns: JSON.stringify(updated.columns),
        labelKey: updated.labelKey,
        colors: JSON.stringify(updated.colors),
      });
    },
    [config, updateAttributes]
  );

  const handleDataSourceChange = useCallback(
    (ds: DataSourceConfig) => {
      updateAttributes({ dataSource: JSON.stringify(ds) });
    },
    [updateAttributes]
  );

  const handleSync = useCallback(async () => {
    if (dataSource.type === "manual" || !dataSource.url) return;
    setSyncing(true);
    setSyncError(null);
    try {
      const result = await fetchDataFromSource(dataSource);
      if (result) {
        updateAttributes({
          data: JSON.stringify(result.data),
          columns: JSON.stringify(result.columns),
          labelKey: result.labelKey,
          dataSource: JSON.stringify({ ...dataSource, lastFetched: new Date().toISOString() }),
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur de synchronisation";
      setSyncError(message);
      setTimeout(() => setSyncError(null), 5000);
    } finally {
      setSyncing(false);
    }
  }, [dataSource, updateAttributes]);

  // Auto-refresh pour les sources distantes
  const handleSyncRef = useRef(handleSync);
  handleSyncRef.current = handleSync;

  useEffect(() => {
    if (dataSource.type === "manual" || !dataSource.url || !dataSource.refreshInterval) return;

    // Sync au montage si jamais synchronisé ou données périmées
    const staleMs = dataSource.refreshInterval * 60 * 1000;
    const isStale = !dataSource.lastFetched || (Date.now() - new Date(dataSource.lastFetched).getTime()) > staleMs;
    if (isStale) handleSyncRef.current();

    const interval = setInterval(() => handleSyncRef.current(), staleMs);
    return () => clearInterval(interval);
  }, [dataSource.type, dataSource.url, dataSource.refreshInterval, dataSource.lastFetched]);

  const exportAs = useCallback(
    async (format: "png" | "svg") => {
      if (!chartRef.current) return;
      try {
        const fn = format === "png" ? toPng : toSvg;
        const dataUrl = await fn(chartRef.current, {
          backgroundColor: "white",
          pixelRatio: 2,
        });
        const link = document.createElement("a");
        link.download = `graphique${config.title ? "-" + config.title.replace(/\s+/g, "-") : ""}.${format}`;
        link.href = dataUrl;
        link.click();
      } catch (err) {
        console.error("Export error:", err);
      }
    },
    [config.title]
  );

  return (
    <NodeViewWrapper className={`chart-block-wrapper ${selected ? "is-selected" : ""}`}>
      <div className="chart-block group/chart" contentEditable={false}>
        {/* Toolbar — masquée par défaut, visible au hover/selected */}
        <div className={`chart-block-toolbar ${selected || editing ? "is-visible" : ""}`}>
          <div className="flex items-center gap-2 flex-1 min-w-0" data-drag-handle>
            <GripHorizontal className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
            <input
              type="text"
              value={config.title || ""}
              onChange={(e) => handleChange({ title: e.target.value })}
              onMouseDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              placeholder="Graphique"
              className="flex-1 px-1.5 py-0.5 text-xs font-medium rounded border-none bg-transparent focus:outline-none focus:ring-1 focus:ring-primary truncate"
            />
          </div>
          <div className="flex items-center gap-1">
            {dataSource.type !== "manual" && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleSync}
                disabled={syncing}
                title="Synchroniser les données"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setEditing(!editing)}
              title={editing ? "Aperçu" : "Modifier"}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => exportAs("png")}
              title="Exporter PNG"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => exportAs("svg")}
              title="Exporter SVG"
            >
              <span className="text-[10px] font-bold">SVG</span>
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={deleteNode}
              className="hover:text-destructive hover:bg-destructive/10"
              title="Supprimer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Titre au-dessus du graphique */}
        {config.title && (
          <div className="px-4 pt-3 text-sm font-semibold text-center">{config.title}</div>
        )}

        {/* Chart preview — Recharts chargé dynamiquement */}
        <Suspense fallback={<div className="flex items-center justify-center h-[320px] text-muted-foreground text-sm">Chargement du graphique…</div>}>
          <LazyChartRenderer config={config} chartRef={chartRef} />
        </Suspense>

        {/* Erreur de synchronisation */}
        {syncError && (
          <div className="mx-4 mb-2 px-3 py-1.5 rounded text-xs bg-destructive/10 text-destructive">
            {syncError}
          </div>
        )}

        {/* Data editor */}
        {editing && (
          <DataEditor
            config={config}
            onChange={handleChange}
            onClose={() => setEditing(false)}
            dataSource={dataSource}
            onDataSourceChange={handleDataSourceChange}
            onSync={handleSync}
            syncing={syncing}
          />
        )}
      </div>
    </NodeViewWrapper>
  );
}

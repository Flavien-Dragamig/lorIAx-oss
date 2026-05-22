"use client";

import {
  Upload,
  Download,
  Filter,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ViewMode } from "./types";
import { VIEW_ICONS, VIEW_LABELS } from "./constants";
import { SyncConfigPanel } from "./sync-config-panel";
import type { DbData } from "./types";
import { exportCsv } from "./database-import-modal";

// ─── Database Toolbar ────────────────────────────────────────────────────────

export function DatabaseToolbar({
  data,
  viewMode,
  onViewModeChange,
  showFilters,
  onToggleFilters,
  filtersCount,
  onShowImport,
  onRefresh,
  fullscreen,
  onToggleFullscreen,
}: {
  data: DbData;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  filtersCount: number;
  onShowImport: () => void;
  onRefresh: () => void;
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
}) {
  return (
    <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-muted/30">
      {/* View mode selector */}
      <div className="flex items-center gap-0.5 mr-2">
        {(["table", "kanban", "gallery"] as ViewMode[]).map((mode) => (
          <Button
            key={mode}
            onClick={() => onViewModeChange(mode)}
            variant={viewMode === mode ? "secondary" : "ghost"}
            size="xs"
            title={VIEW_LABELS[mode]}
          >
            {VIEW_ICONS[mode]}
            <span className="hidden sm:inline">{VIEW_LABELS[mode]}</span>
          </Button>
        ))}
      </div>

      <div className="flex-1" />

      {/* Filter toggle */}
      <Button
        onClick={onToggleFilters}
        variant={(showFilters || filtersCount > 0) ? "secondary" : "ghost"}
        size="xs"
        title="Filtrer"
      >
        <Filter className="h-3.5 w-3.5" />
        {filtersCount > 0 && <span>{filtersCount}</span>}
      </Button>

      {/* Import */}
      <Button
        onClick={onShowImport}
        variant="ghost"
        size="icon-sm"
        title="Importer CSV"
        aria-label="Importer un fichier CSV"
      >
        <Upload className="h-3.5 w-3.5" />
      </Button>

      {/* Export */}
      <Button
        onClick={() => exportCsv(data)}
        variant="ghost"
        size="icon-sm"
        title="Exporter CSV"
        aria-label="Exporter en CSV"
      >
        <Download className="h-3.5 w-3.5" />
      </Button>

      {/* Plein écran */}
      {onToggleFullscreen && (
        <Button
          onClick={onToggleFullscreen}
          variant="ghost"
          size="icon-sm"
          title={fullscreen ? "Quitter le plein écran" : "Plein écran"}
          aria-label={fullscreen ? "Quitter le plein écran" : "Afficher en plein écran"}
        >
          {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </Button>
      )}

      {/* Sync externe */}
      <div className="relative">
        <SyncConfigPanel databaseId={data.id} onRefresh={onRefresh} />
      </div>
    </div>
  );
}

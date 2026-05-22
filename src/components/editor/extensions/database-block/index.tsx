"use client";

import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/core";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Database,
  GripHorizontal,
  Trash2,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { DbData, DbListItem, ViewMode } from "./types";
import { fetchJson, apiPost, apiPatch, apiDelete } from "./api";
import { DatabaseTable } from "./database-table-view";

// Re-export types for consumers
export type { ColumnType, DbColumn, DbRow, DbData, DbListItem, ViewMode, SortConfig, FilterConfig, SyncMapping } from "./types";

// ─── Database Creator ────────────────────────────────────────────────────────

function DatabaseCreator({
  spaceId,
  onSelect,
  onCreate,
}: {
  spaceId: string;
  onSelect: (db: DbListItem) => void;
  onCreate: (name: string) => void;
}) {
  const [databases, setDatabases] = useState<DbListItem[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!spaceId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchJson<DbListItem[]>(`/api/databases?spaceId=${spaceId}`)
      .then(setDatabases)
      .catch(() => setDatabases([]))
      .finally(() => setLoading(false));
  }, [spaceId]);

  return (
    <div className="database-block-creator">
      <div className="flex items-center gap-2 mb-3">
        <Database className="h-5 w-5 text-emerald-500" />
        <span className="text-sm font-medium">Base de donn&eacute;es</span>
      </div>

      {/* Create new */}
      <div className="flex gap-2 mb-3">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom de la nouvelle base..."
          className="flex-1 text-sm px-3 py-2 rounded-md border bg-background"
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) {
              onCreate(name.trim());
            }
          }}
        />
        <button
          onClick={() => name.trim() && onCreate(name.trim())}
          disabled={!name.trim()}
          className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
        >
          Cr&eacute;er
        </button>
      </div>

      {/* Existing databases */}
      {!loading && databases.length > 0 && (
        <div>
          <span className="text-xs text-muted-foreground mb-1.5 block">
            Ou s&eacute;lectionner une base existante
          </span>
          <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
            {databases.map((db) => (
              <button
                key={db.id}
                onClick={() => onSelect(db)}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent text-left transition-colors"
              >
                <Database className="h-4 w-4 text-muted-foreground shrink-0" />
                {db.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="text-xs text-muted-foreground animate-pulse">
          Chargement...
        </div>
      )}
    </div>
  );
}

// ─── Node View ───────────────────────────────────────────────────────────────

export function DatabaseBlockView({
  node,
  updateAttributes,
  selected,
  deleteNode,
  editor: _editor,
}: Pick<NodeViewProps, "node" | "updateAttributes" | "selected" | "deleteNode" | "editor">) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  // Synchroniser le state React avec le fullscreen natif (Échap, etc.)
  useEffect(() => {
    const handleChange = () => {
      setFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleChange);
    return () => document.removeEventListener("fullscreenchange", handleChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  const attrs = node.attrs;
  const databaseId = attrs.databaseId as string | null;
  const [data, setData] = useState<DbData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!databaseId);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");

  // Get spaceId from global (set by loriax-editor.tsx)
  const spaceId = typeof window !== "undefined"
    ? window.__loriax_spaceId ?? ""
    : "";

  const loadData = useCallback(async () => {
    if (!databaseId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchJson<DbData>(`/api/databases/${databaseId}`);
      setData(result);
    } catch {
      setError("Base de données introuvable");
    } finally {
      setLoading(false);
    }
  }, [databaseId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = useCallback(
    async (name: string) => {
      try {
        const db = await apiPost<{ id: string; name: string }>(
          "/api/databases",
          { name, spaceId }
        );
        // Add 3 empty rows by default
        await Promise.all([
          apiPost(`/api/databases/${db.id}/rows`, { cells: {} }),
          apiPost(`/api/databases/${db.id}/rows`, { cells: {} }),
          apiPost(`/api/databases/${db.id}/rows`, { cells: {} }),
        ]);
        updateAttributes({ databaseId: db.id, databaseName: db.name });
        toast.success("Base de données créée");
      } catch (err) {
        console.error("Failed to create database:", err);
        toast.error("Erreur lors de la création de la base");
      }
    },
    [spaceId, updateAttributes]
  );

  const handleSelect = useCallback(
    (db: DbListItem) => {
      updateAttributes({ databaseId: db.id, databaseName: db.name });
    },
    [updateAttributes]
  );

  const handleRename = useCallback(
    async (name: string) => {
      if (!databaseId || !name.trim()) return;
      await apiPatch(`/api/databases/${databaseId}`, { name: name.trim() });
      updateAttributes({ databaseName: name.trim() });
      loadData();
      setEditingName(false);
    },
    [databaseId, updateAttributes, loadData]
  );

  const handleDeleteDb = useCallback(async () => {
    if (!databaseId) return;
    try {
      await apiDelete(`/api/databases/${databaseId}`, {});
      toast.success("Base de données supprimée");
      deleteNode();
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  }, [databaseId, deleteNode]);

  return (
    <NodeViewWrapper
      ref={wrapperRef}
      className={`database-block-wrapper ${selected ? "is-selected" : ""}`}
    >
      <div className="database-block" contentEditable={false}>
        {/* State: no database selected -> creator */}
        {!databaseId && (
          <DatabaseCreator
            spaceId={spaceId}
            onSelect={handleSelect}
            onCreate={handleCreate}
          />
        )}

        {/* State: loading */}
        {databaseId && loading && (
          <div className="p-6 text-center text-sm text-muted-foreground animate-pulse">
            Chargement de la base de donn&eacute;es...
          </div>
        )}

        {/* State: error */}
        {databaseId && error && (
          <div className="p-6 text-center">
            <p className="text-sm text-muted-foreground mb-2">{error}</p>
            <button
              onClick={deleteNode}
              className="text-xs text-destructive hover:underline"
            >
              Retirer le bloc
            </button>
          </div>
        )}

        {/* State: data loaded -> table */}
        {databaseId && data && !loading && !error && (
          <>
            {/* Toolbar */}
            <div
              className={`database-block-toolbar ${
                selected ? "is-visible" : ""
              }`}
            >
              <div
                className="flex items-center gap-2 flex-1 min-w-0"
                data-drag-handle
              >
                <GripHorizontal className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
                <Database className="h-4 w-4 text-emerald-500 shrink-0" />
                {editingName ? (
                  <input
                    autoFocus
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    onMouseDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
                    onBlur={() => handleRename(nameValue)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(nameValue);
                      if (e.key === "Escape") setEditingName(false);
                    }}
                    className="text-sm font-medium bg-background border rounded px-1.5 py-0.5 min-w-0"
                  />
                ) : (
                  <button
                    onClick={() => {
                      setNameValue(data.name);
                      setEditingName(true);
                    }}
                    className="text-sm font-medium truncate hover:underline"
                  >
                    {data.name}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  onClick={toggleFullscreen}
                  variant="ghost"
                  size="icon-sm"
                  title={fullscreen ? "Quitter le plein écran" : "Plein écran"}
                >
                  {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  onClick={handleDeleteDb}
                  variant="ghost"
                  size="icon-sm"
                  className="hover:text-destructive hover:bg-destructive/10"
                  title="Supprimer la base"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Table */}
            <DatabaseTable
                data={data}
                spaceId={spaceId}
                onRefresh={loadData}
                viewMode={(attrs.viewMode as ViewMode) || "table"}
                onViewModeChange={(mode) => updateAttributes({ viewMode: mode })}
              />
          </>
        )}
      </div>
    </NodeViewWrapper>
  );
}


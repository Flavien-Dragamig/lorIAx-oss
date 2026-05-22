"use client";

import { useState, useEffect, useRef } from "react";
import {
  Plus,
  Trash2,
  Check,
  MoreHorizontal,
  Pencil,
} from "lucide-react";
import type { ColumnType, ColumnConfig, DbColumn, DbListItem } from "./types";
import { COLUMN_TYPE_ICONS, COLUMN_TYPE_LABELS } from "./constants";

// ─── Relation Config Editor ─────────────────────────────────────────────────

function RelationConfigEditor({
  column,
  allDatabases,
  currentDatabaseId,
  onUpdateConfig,
}: {
  column: DbColumn;
  allDatabases: DbListItem[];
  currentDatabaseId: string;
  onUpdateConfig: (config: ColumnConfig) => void;
}) {
  const targetDbId = column.config?.targetDatabaseId ?? "";
  const otherDatabases = allDatabases.filter((db) => db.id !== currentDatabaseId);

  return (
    <div className="border-t px-3 py-2">
      <span className="text-xs text-muted-foreground block mb-1">Base cible</span>
      <select
        value={targetDbId}
        onChange={(e) =>
          onUpdateConfig({ ...column.config, targetDatabaseId: e.target.value || undefined })
        }
        className="w-full text-xs px-2 py-1.5 rounded border bg-background"
      >
        <option value="">— Choisir une base —</option>
        {otherDatabases.map((db) => (
          <option key={db.id} value={db.id}>
            {db.name}
          </option>
        ))}
      </select>
      {otherDatabases.length === 0 && (
        <p className="text-xs text-muted-foreground mt-1 italic">
          Aucune autre base dans cet espace
        </p>
      )}
    </div>
  );
}

// ─── Column Header Menu ─────────────────────────────────────────────────────

export function ColumnHeaderMenu({
  column,
  onRename,
  onChangeType,
  onDelete,
  onUpdateConfig,
  allDatabases,
  currentDatabaseId,
}: {
  column: DbColumn;
  onRename: (name: string) => void;
  onChangeType: (type: ColumnType) => void;
  onDelete: () => void;
  onUpdateConfig: (config: ColumnConfig) => void;
  allDatabases: DbListItem[];
  currentDatabaseId: string;
}) {
  const [open, setOpen] = useState(false);
  const [alignLeft, setAlignLeft] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameValue, setNameValue] = useState(column.name);
  const [editingOptions, setEditingOptions] = useState(false);
  const [optionsValue, setOptionsValue] = useState(
    (Array.isArray(column.config?.options) ? column.config.options : []).join(", ")
  );
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as globalThis.Node)) {
        setOpen(false);
        setRenaming(false);
        setEditingOptions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => {
          if (!open && menuRef.current) {
            const rect = menuRef.current.getBoundingClientRect();
            setAlignLeft(rect.left < window.innerWidth / 2);
          }
          setOpen(!open);
        }}
        className="p-0.5 rounded hover:bg-accent transition-colors opacity-0 group-hover/col:opacity-100"
        aria-label={`Options de la colonne ${column.name}`}
      >
        <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className={`absolute top-full mt-1 z-50 w-52 rounded-md border bg-popover text-popover-foreground shadow-md ${alignLeft ? "left-0" : "right-0"}`}>
          {/* Rename */}
          {renaming ? (
            <div className="p-2 flex gap-1">
              <input
                autoFocus
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onRename(nameValue);
                    setRenaming(false);
                    setOpen(false);
                  }
                }}
                className="flex-1 text-sm px-2 py-1 rounded border bg-background"
              />
              <button
                onClick={() => {
                  onRename(nameValue);
                  setRenaming(false);
                  setOpen(false);
                }}
                className="p-1 rounded hover:bg-accent"
                aria-label="Valider le renommage"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setRenaming(true)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
            >
              <Pencil className="h-3.5 w-3.5" />
              Renommer
            </button>
          )}

          {/* Type selector */}
          <div className="border-t px-3 py-1.5">
            <span className="text-xs text-muted-foreground">Type</span>
            <div className="flex flex-col gap-0.5 mt-1">
              {(Object.keys(COLUMN_TYPE_LABELS) as ColumnType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    onChangeType(t);
                    setOpen(false);
                  }}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors ${
                    column.type === t
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  }`}
                >
                  {COLUMN_TYPE_ICONS[t]}
                  {COLUMN_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Select options editor */}
          {column.type === "select" && (
            <div className="border-t px-3 py-2">
              {editingOptions ? (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Options (virgules)</span>
                  <input
                    autoFocus
                    value={optionsValue}
                    onChange={(e) => setOptionsValue(e.target.value)}
                    className="text-xs px-2 py-1 rounded border bg-background"
                    placeholder="Option A, Option B, Option C"
                  />
                  <button
                    onClick={() => {
                      const options = optionsValue
                        .split(",")
                        .map((s: string) => s.trim())
                        .filter(Boolean);
                      onUpdateConfig({ ...column.config, options });
                      setEditingOptions(false);
                    }}
                    className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Valider
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingOptions(true)}
                  className="text-xs text-primary hover:underline"
                >
                  Modifier les options
                </button>
              )}
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input type="checkbox" checked={!!column.config?.multiple} onChange={(e) => onUpdateConfig({ ...column.config, multiple: e.target.checked })} onMouseDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }} onPointerDown={(e) => e.stopPropagation()} className="h-3.5 w-3.5 rounded accent-primary" />
                <span className="text-xs text-muted-foreground">Choix multiple</span>
              </label>
            </div>
          )}

          {/* Number unit editor */}
          {column.type === "number" && (
            <div className="border-t px-3 py-2">
              <span className="text-xs text-muted-foreground block mb-1">Unité</span>
              <input value={column.config?.unit ?? ""} onChange={(e) => onUpdateConfig({ ...column.config, unit: e.target.value || undefined })} className="w-full text-xs px-2 py-1 rounded border bg-background" placeholder="€, kg, km, %..." />
            </div>
          )}

          {/* Formula editor */}
          {column.type === "formula" && (
            <div className="border-t px-3 py-2">
              <span className="text-xs text-muted-foreground block mb-1">Formule</span>
              <textarea value={column.config?.formula ?? ""} onChange={(e) => onUpdateConfig({ ...column.config, formula: e.target.value })} className="w-full text-xs px-2 py-1 rounded border bg-background font-mono resize-y" placeholder='prop("Colonne") * 2' rows={2} />
              <p className="text-[10px] text-muted-foreground mt-1">prop(&quot;Nom&quot;), if(), concat(), round()...</p>
            </div>
          )}

          {/* URL config */}
          {column.type === "url" && (
            <div className="border-t px-3 py-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!column.config?.displayAsButton}
                  onChange={(e) => onUpdateConfig({ ...column.config, displayAsButton: e.target.checked })}
                  onMouseDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="h-3.5 w-3.5 rounded accent-primary"
                />
                <span className="text-xs text-muted-foreground">Afficher en bouton</span>
              </label>
            </div>
          )}

          {/* Relation config */}
          {column.type === "relation" && (
            <RelationConfigEditor
              column={column}
              allDatabases={allDatabases}
              currentDatabaseId={currentDatabaseId}
              onUpdateConfig={(config) => {
                onUpdateConfig(config);
                setOpen(false);
              }}
            />
          )}

          {/* Delete */}
          <div className="border-t">
            <button
              onClick={() => {
                onDelete();
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-accent flex items-center gap-2"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Supprimer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Add Column Menu ─────────────────────────────────────────────────────────

export function AddColumnMenu({
  onAdd,
  allDatabases,
  currentDatabaseId,
}: {
  onAdd: (name: string, type: ColumnType, config?: ColumnConfig) => void;
  allDatabases: DbListItem[];
  currentDatabaseId: string;
}) {
  const [open, setOpen] = useState(false);
  const [alignLeft, setAlignLeft] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<ColumnType>("text");
  const [targetDbId, setTargetDbId] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as globalThis.Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const otherDatabases = allDatabases.filter((db) => db.id !== currentDatabaseId);

  const handleSubmit = () => {
    if (!name.trim()) return;
    const config: ColumnConfig = {};
    if (type === "relation" && targetDbId) {
      config.targetDatabaseId = targetDbId;
    }
    onAdd(name.trim(), type, Object.keys(config).length > 0 ? config : undefined);
    setName("");
    setType("text");
    setTargetDbId("");
    setOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => {
          if (!open && menuRef.current) {
            const rect = menuRef.current.getBoundingClientRect();
            setAlignLeft(rect.left < window.innerWidth / 2);
          }
          setOpen(!open);
        }}
        className="database-block-add-col"
        title="Ajouter une colonne"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className={`absolute top-full mt-1 z-50 w-52 rounded-md border bg-popover text-popover-foreground shadow-md p-3 ${alignLeft ? "left-0" : "right-0"}`}>
          <div className="flex flex-col gap-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom de la colonne"
              className="text-sm px-2 py-1.5 rounded border bg-background"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
            />
            <div className="flex flex-col gap-0.5">
              {(Object.keys(COLUMN_TYPE_LABELS) as ColumnType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors ${
                    type === t
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  }`}
                >
                  {COLUMN_TYPE_ICONS[t]}
                  {COLUMN_TYPE_LABELS[t]}
                </button>
              ))}
            </div>

            {/* Relation target selector */}
            {type === "relation" && (
              <div>
                <span className="text-xs text-muted-foreground block mb-1">Base cible</span>
                <select
                  value={targetDbId}
                  onChange={(e) => setTargetDbId(e.target.value)}
                  className="w-full text-xs px-2 py-1.5 rounded border bg-background"
                >
                  <option value="">— Choisir —</option>
                  {otherDatabases.map((db) => (
                    <option key={db.id} value={db.id}>
                      {db.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!name.trim() || (type === "relation" && !targetDbId)}
              className="text-sm px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Ajouter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

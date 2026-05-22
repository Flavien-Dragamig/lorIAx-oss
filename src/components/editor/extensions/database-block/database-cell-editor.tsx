"use client";

import { useRef, useCallback, memo, useState } from "react";
import { ExternalLink, Mail } from "lucide-react";
import type { DbColumn, DbRow, DbListItem, CellValue } from "./types";
import type { AttachmentMeta } from "./attachment-cell";
import { RelationPicker } from "./relation-picker";
import { ImageCell } from "./image-cell";
import { AttachmentCell } from "./attachment-cell";
import { TimeCell } from "./time-cell";

// Empêche TipTap d'intercepter les événements dans les cellules
function _stopTipTap(e: React.SyntheticEvent) {
  e.stopPropagation();
}

// ─── Cell Editors ────────────────────────────────────────────────────────────

export const CellEditor = memo(function CellEditor({
  column,
  value,
  onChange,
  allDatabases: _allDatabases,
  relationData,
  spaceId,
  editable = true,
}: {
  column: DbColumn;
  value: CellValue;
  onChange: (val: CellValue) => void;
  allDatabases?: DbListItem[];
  relationData?: Record<string, { rows: DbRow[]; columns: DbColumn[] }>;
  spaceId?: string;
  editable?: boolean;
}) {
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const debouncedChange = useCallback(
    (val: CellValue) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => onChange(val), 300);
    },
    [onChange]
  );

  switch (column.type) {
    case "text":
      return (
        <input
          type="text"
          defaultValue={String(value ?? "")}
          onChange={(e) => debouncedChange(e.target.value)}
          className="database-block-cell-input"
          placeholder="..."
        />
      );

    case "number": {
      const unit = column.config?.unit as string | undefined;
      return (
        <div className="flex items-center">
          <input
            type="number"
            defaultValue={value != null ? String(value) : ""}
            onChange={(e) => debouncedChange(e.target.value ? Number(e.target.value) : null)}
            className="database-block-cell-input text-right flex-1"
            placeholder="0"
          />
          {unit && <span className="text-xs text-muted-foreground pr-2 shrink-0">{unit}</span>}
        </div>
      );
    }

    case "date":
      return (
        <input
          type="date"
          defaultValue={String(value ?? "")}
          onChange={(e) => debouncedChange(e.target.value)}
          className="database-block-cell-input"
        />
      );

    case "checkbox":
      return (
        <div
          className="flex items-center justify-center h-full cursor-pointer py-1"
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); onChange(!value); }}
          onMouseDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className={`h-4 w-4 rounded border-2 flex items-center justify-center transition-colors ${value ? "bg-primary border-primary" : "border-border"}`}>
            {value && (
              <svg className="h-3 w-3 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
        </div>
      );

    case "select": {
      const rawOptions = column.config?.options as string[] | string | undefined;
      const options: string[] = Array.isArray(rawOptions)
        ? rawOptions
        : typeof rawOptions === "string"
          ? rawOptions.split(",").map((s) => s.trim()).filter(Boolean)
          : [];
      const isMultiple = !!column.config?.multiple;
      if (!isMultiple) {
        return (
          <select value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} className="database-block-cell-input">
            <option value="">—</option>
            {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        );
      }
      const selected: string[] = Array.isArray(value) ? value : [];
      const available = options.filter((o) => !selected.includes(o));
      return (
        <div className="flex flex-wrap items-center gap-1 px-2 py-1 min-h-[32px]">
          {selected.map((val) => (
            <span key={val} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
              {val}
              <button type="button" onClick={() => onChange(selected.filter((s) => s !== val))} onMouseDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }} className="hover:text-destructive">×</button>
            </span>
          ))}
          {available.length > 0 && (
            <select value="" onChange={(e) => { if (e.target.value) onChange([...selected, e.target.value]); }} onMouseDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }} className="text-xs bg-transparent border-none outline-none cursor-pointer text-muted-foreground">
              <option value="">+</option>
              {available.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          )}
        </div>
      );
    }

    case "relation": {
      const selected: string[] = Array.isArray(value) ? value : [];
      const targetDbId = column.config?.targetDatabaseId;

      if (!targetDbId) {
        return (
          <div className="flex items-center p-1 min-h-[32px]">
            <span className="text-xs text-muted-foreground italic">
              Configurer la base cible...
            </span>
          </div>
        );
      }

      const targetData = relationData?.[targetDbId];
      const targetRows = targetData?.rows ?? [];
      const targetColumns = targetData?.columns;

      return (
        <RelationPicker
          selected={selected}
          targetRows={targetRows}
          targetColumns={targetColumns}
          onChange={onChange}
        />
      );
    }

    case "formula": {
      const formulaStr = column.config?.formula as string | undefined;
      if (!formulaStr) return <span className="text-xs text-muted-foreground italic px-2">Configurer la formule...</span>;
      return <span className="text-xs px-2 py-1">{String(value ?? "")}</span>;
    }

    case "url": {
      const displayAsButton = !!column.config?.displayAsButton;
      const urlValue = typeof value === "string" ? value : "";
      return (
        <UrlCell
          value={urlValue}
          displayAsButton={displayAsButton}
          onChange={onChange}
          editable={editable}
        />
      );
    }

    case "email": {
      const emailValue = typeof value === "string" ? value : "";
      return (
        <EmailCell
          value={emailValue}
          onChange={onChange}
          editable={editable}
        />
      );
    }

    case "image":
      return (
        <ImageCell
          value={(value as string) ?? null}
          onChange={onChange}
          spaceId={spaceId ?? ""}
          editable={editable}
        />
      );

    case "attachment":
      return (
        <AttachmentCell
          value={value as AttachmentMeta[] | null | undefined}
          onChange={onChange as unknown as (v: AttachmentMeta[]) => void}
          readOnly={!editable}
          spaceId={spaceId}
        />
      );

    case "time":
      return (
        <TimeCell
          value={value as string | null | undefined}
          onChange={onChange as (v: string) => void}
          readOnly={!editable}
        />
      );

    default:
      return <span className="text-muted-foreground text-xs">{String(value ?? "")}</span>;
  }
})

// ─── URL Cell ────────────────────────────────────────────────────────────────

const UrlCell = memo(function UrlCell({
  value,
  displayAsButton,
  onChange,
  editable,
}: {
  value: string;
  displayAsButton: boolean;
  onChange: (val: string) => void;
  editable: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const href = value && !value.startsWith("http") ? `https://${value}` : value;

  if (editing && editable) {
    return (
      <input
        autoFocus
        type="url"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => onChange(e.target.value), 300);
        }}
        onBlur={() => { onChange(draft); setEditing(false); }}
        onKeyDown={(e) => { if (e.key === "Enter") { onChange(draft); setEditing(false); } }}
        className="database-block-cell-input"
        placeholder="https://..."
      />
    );
  }

  if (!value) {
    return (
      <div
        className="px-2 py-1 min-h-[32px] cursor-text text-muted-foreground text-xs italic"
        onClick={() => { if (editable) { setDraft(""); setEditing(true); } }}
      >
        ...
      </div>
    );
  }

  if (displayAsButton) {
    return (
      <div className="flex items-center gap-1 px-1 py-0.5">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <ExternalLink className="h-3 w-3 shrink-0" />
          Ouvrir
        </a>
        {editable && (
          <button
            type="button"
            onClick={() => { setDraft(value); setEditing(true); }}
            onMouseDown={(e) => e.stopPropagation()}
            className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors opacity-0 group-hover/row:opacity-100"
            title="Modifier l'URL"
          >
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 1 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 px-2 min-h-[32px]">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className="text-xs text-primary hover:underline truncate max-w-[160px]"
        title={value}
      >
        {value}
      </a>
      <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
      {editable && (
        <button
          type="button"
          onClick={() => { setDraft(value); setEditing(true); }}
          onMouseDown={(e) => e.stopPropagation()}
          className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors opacity-0 group-hover/row:opacity-100 ml-auto"
          title="Modifier l'URL"
        >
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 1 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
      )}
    </div>
  );
});

// ─── Email Cell ───────────────────────────────────────────────────────────────

const EmailCell = memo(function EmailCell({
  value,
  onChange,
  editable,
}: {
  value: string;
  onChange: (val: string) => void;
  editable: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  if (editing && editable) {
    return (
      <input
        autoFocus
        type="email"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => onChange(e.target.value), 300);
        }}
        onBlur={() => { onChange(draft); setEditing(false); }}
        onKeyDown={(e) => { if (e.key === "Enter") { onChange(draft); setEditing(false); } }}
        className="database-block-cell-input"
        placeholder="nom@domaine.fr"
      />
    );
  }

  if (!value) {
    return (
      <div
        className="px-2 py-1 min-h-[32px] cursor-text text-muted-foreground text-xs italic"
        onClick={() => { if (editable) { setDraft(""); setEditing(true); } }}
      >
        ...
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 px-2 min-h-[32px]">
      <a
        href={`mailto:${value}`}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className="text-xs text-primary hover:underline truncate max-w-[160px]"
        title={value}
      >
        {value}
      </a>
      <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
      {editable && (
        <button
          type="button"
          onClick={() => { setDraft(value); setEditing(true); }}
          onMouseDown={(e) => e.stopPropagation()}
          className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors opacity-0 group-hover/row:opacity-100 ml-auto"
          title="Modifier l'e-mail"
        >
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 1 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
      )}
    </div>
  );
});

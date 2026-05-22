"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Tag, Check } from "lucide-react";
import { toast } from "sonner";
import { LabelBadge } from "./label-badge";

interface Label {
  id: string;
  name: string;
  color: string;
}

interface LabelPickerProps {
  documentId: string;
  spaceSlug: string;
  currentLabelIds: string[];
  onLabelsChange?: (labelIds: string[]) => void;
  /** Ouvre le picker directement à l'initialisation (ex : depuis un menu contextuel) */
  defaultOpen?: boolean;
  /** Appelé quand le picker se ferme (utile quand defaultOpen=true) */
  onClose?: () => void;
}

export function LabelPicker({
  documentId,
  spaceSlug,
  currentLabelIds,
  onLabelsChange,
  defaultOpen = false,
  onClose,
}: LabelPickerProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [labels, setLabels] = useState<Label[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(currentLabelIds);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync selectedIds when currentLabelIds prop changes
  useEffect(() => {
    setSelectedIds(currentLabelIds);
  }, [currentLabelIds]);

  // Fetch labels when opening
  const fetchLabels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/spaces/${spaceSlug}/labels`);
      if (!res.ok) throw new Error("Impossible de charger les labels");
      const data = await res.json();
      setLabels(data);
    } catch {
      toast.error("Impossible de charger les labels");
    } finally {
      setLoading(false);
    }
  }, [spaceSlug]);

  // Si defaultOpen, charger les labels au montage
  useEffect(() => {
    if (defaultOpen) {
      fetchLabels();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpen = () => {
    if (!open) {
      fetchLabels();
    }
    setOpen((v) => !v);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        onClose?.();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const toggleLabel = async (label: Label) => {
    const isSelected = selectedIds.includes(label.id);
    // Optimistic update
    const newIds = isSelected
      ? selectedIds.filter((id) => id !== label.id)
      : [...selectedIds, label.id];
    setSelectedIds(newIds);
    onLabelsChange?.(newIds);

    try {
      const url = isSelected
        ? `/api/documents/${documentId}/labels/${label.id}`
        : `/api/documents/${documentId}/labels`;
      const method = isSelected ? "DELETE" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(isSelected ? {} : { body: JSON.stringify({ labelId: label.id }) }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Revert on error
      setSelectedIds(selectedIds);
      onLabelsChange?.(selectedIds);
      toast.error(
        isSelected
          ? "Impossible de retirer le label"
          : "Impossible d'assigner le label"
      );
    }
  };

  const filtered = labels.filter((l) =>
    l.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Tag className="h-3.5 w-3.5" />
        <span>Labels</span>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 w-60 rounded-lg border bg-background shadow-lg"
          role="listbox"
          aria-multiselectable="true"
          aria-label="Sélectionner des labels"
        >
          {/* Search */}
          <div className="border-b p-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher…"
              className="w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
              autoFocus
            />
          </div>

          {/* Labels list */}
          <ul className="max-h-56 overflow-y-auto py-1">
            {loading && (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                Chargement…
              </li>
            )}
            {!loading && filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                Aucun label trouvé
              </li>
            )}
            {!loading &&
              filtered.map((label) => {
                const selected = selectedIds.includes(label.id);
                return (
                  <li key={label.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => toggleLabel(label)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted transition-colors"
                    >
                      <LabelBadge label={label} size="sm" />
                      {selected && (
                        <Check className="ml-auto h-3.5 w-3.5 text-foreground shrink-0" />
                      )}
                    </button>
                  </li>
                );
              })}
          </ul>

          {/* Footer */}
          <div className="border-t p-2">
            <a
              href="/admin/labels"
              className="block w-full rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-center"
            >
              + Créer un label
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

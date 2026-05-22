"use client";

import { useState, useEffect, useRef, memo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  FileText,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  GripVertical,
  Trash2,
  BookMarked,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { useFavoritesContext } from "@/hooks/use-favorites";
import { FavoriteStar } from "@/components/ui/favorite-star";
import { SaveAsTemplateDialog } from "@/components/document/save-as-template-dialog";
import { LabelBadge } from "@/components/labels/label-badge";
import { LabelPicker } from "@/components/labels/label-picker";
import type { DocumentItem } from "./types";

// ─── Folder droppable (cible de dépôt uniquement, pas de tri) ───────────────

const FolderNode = memo(function FolderNode({
  doc,
  spaceSlug,
  depth,
  onDeleted,
}: {
  doc: DocumentItem;
  spaceSlug: string;
  depth: number;
  onDeleted?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const { setNodeRef, isOver } = useDroppable({
    id: doc.id,
    data: { type: "folder", folderId: doc.id },
  });

  useEffect(() => {
    if (!contextMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [contextMenu]);

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }

  async function handleDelete() {
    setContextMenu(null);
    if (!window.confirm("Supprimer ce dossier et tout son contenu ? Cette action est irréversible.")) return;
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Dossier supprimé");
        onDeleted?.();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Erreur lors de la suppression");
      }
    } catch {
      toast.error("Erreur réseau");
    }
  }

  return (
    <li
      ref={setNodeRef}
      className={isOver ? "bg-primary/10 ring-2 ring-primary/30 rounded-md" : undefined}
    >
      <div
        className="w-full flex items-center gap-1 pr-2 py-1.5 rounded-md text-sm hover:bg-sidebar-accent transition-colors group"
        style={{ paddingLeft: `${8 + depth * 8}px` }}
        onContextMenu={handleContextMenu}
      >
        {/* Spacer aligné sur le grip des documents */}
        <span className="w-3 flex-shrink-0" />
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 flex-1 min-w-0"
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          )}
          {doc.icon ? (
            <span className="text-base leading-none flex-shrink-0">{doc.icon}</span>
          ) : (
            <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
          <span className="truncate">{doc.title}</span>
        </button>
      </div>
      {expanded && doc.children && doc.children.length > 0 && (
        <SortableDocumentTree
          documents={doc.children}
          spaceSlug={spaceSlug}
          depth={depth + 1}
          onDeleted={onDeleted}
        />
      )}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-[100] w-44 bg-popover border border-border rounded-lg shadow-lg p-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={handleDelete}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4 shrink-0" />
            Supprimer
          </button>
        </div>
      )}
    </li>
  );
});

// ─── Document sortable (draggable + réordonnable) ───────────────────────────

const SortableDocumentNode = memo(function SortableDocumentNode({
  doc: initialDoc,
  spaceSlug,
  depth,
  pathname,
  onDeleted,
}: {
  doc: DocumentItem;
  spaceSlug: string;
  depth: number;
  pathname: string;
  onDeleted?: () => void;
}) {
  const [doc, setDoc] = useState<DocumentItem>(initialDoc);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [saveAsTemplateOpen, setSaveAsTemplateOpen] = useState(false);
  const [documentContent, setDocumentContent] = useState("");
  const [documentSpaceId, setDocumentSpaceId] = useState("");
  const [isFetchingContent, setIsFetchingContent] = useState(false);
  const [labelPickerOpen, setLabelPickerOpen] = useState(false);
  const router = useRouter();
  const { isFavorite, toggleFavorite } = useFavoritesContext();
  const href = `/s/${spaceSlug}/${doc.id}`;
  const isActive = pathname === href;

  // Sync doc quand la prop change (ex : rechargement arborescence)
  useEffect(() => {
    setDoc(initialDoc);
  }, [initialDoc]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: doc.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  useEffect(() => {
    if (!contextMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [contextMenu]);

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }

  async function handleDelete() {
    setContextMenu(null);
    if (!window.confirm("Supprimer ce document ? Cette action est irréversible.")) return;
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Document supprimé");
        if (isActive) {
          router.push(`/s/${spaceSlug}`);
        }
        onDeleted?.();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Erreur lors de la suppression");
      }
    } catch {
      toast.error("Erreur réseau");
    }
  }

  async function handleSaveAsTemplate() {
    setContextMenu(null);
    setIsFetchingContent(true);
    try {
      const res = await fetch(`/api/documents/${doc.id}`);
      if (!res.ok) {
        toast.error("Impossible de récupérer le contenu du document");
        return;
      }
      const data = await res.json();
      setDocumentContent(data.content ?? "");
      setDocumentSpaceId(data.spaceId ?? "");
      setSaveAsTemplateOpen(true);
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setIsFetchingContent(false);
    }
  }

  function handleOpenLabelPicker() {
    setContextMenu(null);
    setLabelPickerOpen(true);
  }

  function handleLabelsChange(newLabelIds: string[]) {
    // Mise à jour optimiste locale des labels affichés
    // On conserve les objets label existants qui correspondent aux nouveaux ids
    const existingLabels = doc.labels ?? [];
    const updatedLabels = newLabelIds.map((id) => {
      const found = existingLabels.find((l) => l.id === id);
      return found ?? { id, name: "…", color: "#6b7280" };
    });
    setDoc((prev) => ({ ...prev, labels: updatedLabels }));
  }

  const visibleLabels = (doc.labels ?? []).slice(0, 3);
  const extraLabels = (doc.labels ?? []).length - 3;

  return (
    <li ref={setNodeRef} style={style}>
      <div
        className={`flex items-center gap-1 pr-2 py-1.5 rounded-md text-sm transition-colors group cursor-grab active:cursor-grabbing ${
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
            : "hover:bg-sidebar-accent text-sidebar-foreground"
        }`}
        style={{ paddingLeft: `${8 + depth * 8}px` }}
        onContextMenu={handleContextMenu}
        {...attributes}
        {...listeners}
      >
        <span className="opacity-0 group-hover:opacity-50 transition-opacity">
          <GripVertical className="h-3 w-3" />
        </span>
        <div className="flex flex-col flex-1 min-w-0">
          <Link
            href={href}
            className="flex items-center gap-2 min-w-0"
            onClick={(e) => { if (isDragging) e.preventDefault(); }}
          >
            {/* Spacer aligné sur le chevron des dossiers */}
            <span className="w-3.5 flex-shrink-0" />
            {doc.icon ? (
              <span className="text-base leading-none flex-shrink-0">{doc.icon}</span>
            ) : (
              <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}
            <span className="truncate">{doc.title}</span>
          </Link>
          {visibleLabels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-0.5 pl-[calc(0.875rem+0.5rem+1rem)]">
              {visibleLabels.map((label) => (
                <LabelBadge key={label.id} label={label} size="sm" />
              ))}
              {extraLabels > 0 && (
                <span className="text-xs text-muted-foreground">+{extraLabels}</span>
              )}
            </div>
          )}
        </div>
        <FavoriteStar
          entityType="document"
          entityId={doc.id}
          isFavorite={isFavorite("document", doc.id)}
          onToggle={() => toggleFavorite("document", doc.id)}
          size={14}
        />
      </div>
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-[100] w-52 bg-popover border border-border rounded-lg shadow-lg p-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={handleOpenLabelPicker}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-sm transition-colors hover:bg-accent"
          >
            <Tag className="h-4 w-4 shrink-0" />
            Labels
          </button>
          <div className="my-1 h-px bg-border" />
          <button
            onClick={handleSaveAsTemplate}
            disabled={isFetchingContent}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-sm transition-colors hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <BookMarked className="h-4 w-4 shrink-0" />
            {isFetchingContent ? "Chargement…" : "Enregistrer comme template"}
          </button>
          <div className="my-1 h-px bg-border" />
          <button
            onClick={handleDelete}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4 shrink-0" />
            Supprimer
          </button>
        </div>
      )}
      {/* LabelPicker déclenché depuis le menu contextuel */}
      {labelPickerOpen && (
        <div className="px-3 pb-1">
          <LabelPicker
            documentId={doc.id}
            spaceSlug={spaceSlug}
            currentLabelIds={doc.labels?.map((l) => l.id) ?? []}
            onLabelsChange={handleLabelsChange}
            defaultOpen
            onClose={() => setLabelPickerOpen(false)}
          />
        </div>
      )}
      <SaveAsTemplateDialog
        open={saveAsTemplateOpen}
        onOpenChange={setSaveAsTemplateOpen}
        documentTitle={doc.title}
        documentContent={documentContent}
        spaceId={documentSpaceId}
      />
    </li>
  );
});

// ─── Arbre de documents ─────────────────────────────────────────────────────

export function SortableDocumentTree({
  documents,
  spaceSlug,
  depth = 0,
  onDeleted,
}: {
  documents: DocumentItem[];
  spaceSlug: string;
  depth?: number;
  onDeleted?: () => void;
}) {
  const pathname = usePathname();
  const folders = documents.filter((d) => d.isFolder);
  const docs = documents.filter((d) => !d.isFolder);

  return (
    <ul className="space-y-0.5">
      {/* Dossiers : droppable uniquement, hors du SortableContext */}
      {folders.map((folder) => (
        <FolderNode
          key={folder.id}
          doc={folder}
          spaceSlug={spaceSlug}
          depth={depth}
          onDeleted={onDeleted}
        />
      ))}
      {/* Documents : sortable (réordonnement + draggable) */}
      <SortableContext
        items={docs.map((d) => d.id)}
        strategy={verticalListSortingStrategy}
      >
        {docs.map((doc) => (
          <SortableDocumentNode
            key={doc.id}
            doc={doc}
            spaceSlug={spaceSlug}
            depth={depth}
            pathname={pathname}
            onDeleted={onDeleted}
          />
        ))}
      </SortableContext>
    </ul>
  );
}

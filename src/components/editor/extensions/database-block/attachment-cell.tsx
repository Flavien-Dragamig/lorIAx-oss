"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { FileIcon, Download, X, Paperclip, Plus } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AttachmentMeta = {
  key: string;
  filename: string;
  mimeType: string;
  size: number;
};

interface AttachmentCellProps {
  value: AttachmentMeta[] | null | undefined;
  onChange: (value: AttachmentMeta[]) => void;
  readOnly?: boolean;
  spaceId?: string;
}

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

async function getSignedUrl(key: string): Promise<string> {
  try {
    const res = await fetch(
      `/api/attachments/signed?key=${encodeURIComponent(key)}`
    );
    if (!res.ok) return "";
    const data = await res.json();
    return data.url ?? "";
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export function AttachmentCell({
  value,
  onChange,
  readOnly = false,
  spaceId,
}: AttachmentCellProps) {
  const files = value ?? [];
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [thumbnails, setThumbnails] = useState<Map<string, string>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pré-charge les URLs signées pour les miniatures image
  useEffect(() => {
    const imagesToFetch = files.filter(
      (f) => f.mimeType.startsWith("image/") && !thumbnails.has(f.key)
    );
    if (imagesToFetch.length === 0) return;

    let cancelled = false;
    Promise.all(
      imagesToFetch.map(async (f) => {
        const url = await getSignedUrl(f.key);
        return { key: f.key, url };
      })
    ).then((results) => {
      if (cancelled) return;
      setThumbnails((prev) => {
        const next = new Map(prev);
        for (const { key, url } of results) {
          if (url) next.set(key, url);
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
    // Intentionnellement limité : on ne relance que si `files` change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files.map((f) => f.key).join(",")]);

  // Téléchargement : ouvre l'URL signée dans un nouvel onglet
  const handleDownload = useCallback(async (file: AttachmentMeta) => {
    const url = await getSignedUrl(file.key);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  // Suppression d'un fichier
  const handleRemove = useCallback(
    (key: string) => {
      onChange(files.filter((f) => f.key !== key));
      setThumbnails((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
    },
    [files, onChange]
  );

  // Upload des fichiers sélectionnés
  const handleFilesSelected = useCallback(
    async (selected: FileList) => {
      if (!spaceId) return;
      setUploading(true);
      try {
        const uploaded: AttachmentMeta[] = [];
        for (const file of Array.from(selected)) {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("spaceId", spaceId);
          const res = await fetch("/api/attachments", {
            method: "POST",
            body: formData,
          });
          if (!res.ok) {
            console.error("[AttachmentCell] Upload échoué :", file.name);
            continue;
          }
          const data = await res.json();
          uploaded.push({
            key: data.key,
            filename: data.filename,
            mimeType: data.mimeType,
            size: data.size,
          });
        }
        if (uploaded.length > 0) {
          onChange([...files, ...uploaded]);
        }
      } catch (error) {
        console.error("[AttachmentCell] Erreur upload :", error);
      } finally {
        setUploading(false);
        // Réinitialise l'input pour autoriser le re-sélection du même fichier
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [files, onChange, spaceId]
  );

  // ---------------------------------------------------------------------------
  // Rendu : cellule vide (pas de fichiers)
  // ---------------------------------------------------------------------------

  if (files.length === 0) {
    if (readOnly) {
      return (
        <div className="px-2 py-1 text-muted-foreground text-xs">
          Aucun fichier
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1 px-2 py-1">
        <input
          ref={fileInputRef}
          type="file"
          accept="*/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleFilesSelected(e.target.files);
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || !spaceId}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 text-xs"
          title="Ajouter un fichier"
        >
          <Paperclip className="h-3.5 w-3.5" />
          {uploading && <span className="text-xs">Envoi…</span>}
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Rendu : badge + popover
  // ---------------------------------------------------------------------------

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="*/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) handleFilesSelected(e.target.files);
        }}
      />

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-foreground hover:bg-accent transition-colors"
        >
          <Paperclip className="h-3 w-3 text-muted-foreground" />
          <span>
            {files.length} fichier{files.length > 1 ? "s" : ""}
          </span>
        </PopoverTrigger>

        <PopoverContent className="w-72 p-2" sideOffset={6}>
          {/* Liste des fichiers */}
          <ul className="flex flex-col gap-1">
            {files.map((file) => {
              const isImage = file.mimeType.startsWith("image/");
              const thumbUrl = thumbnails.get(file.key);

              return (
                <li
                  key={file.key}
                  className="flex items-center gap-2 rounded p-1 hover:bg-muted/60 transition-colors"
                >
                  {/* Miniature ou icône */}
                  <div className="shrink-0 w-12 h-12 flex items-center justify-center rounded overflow-hidden border border-border bg-muted">
                    {isImage && thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumbUrl}
                        alt={file.filename}
                        className="w-12 h-12 object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <FileIcon className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>

                  {/* Infos */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-xs font-medium truncate max-w-32 text-foreground"
                      title={file.filename}
                    >
                      {file.filename}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatSize(file.size)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleDownload(file)}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title="Télécharger"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => handleRemove(file.key)}
                        className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Supprimer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Bouton Ajouter */}
          {!readOnly && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !spaceId}
              className="mt-2 w-full flex items-center justify-center gap-1.5 rounded border border-dashed border-border px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
              {uploading ? "Envoi en cours…" : "Ajouter un fichier"}
            </button>
          )}
        </PopoverContent>
      </Popover>
    </>
  );
}

"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import { Upload, Link2, X, Loader2 } from "lucide-react";

interface ImageCellProps {
  value: string | null;
  onChange: (url: string | null) => void;
  spaceId: string;
  editable: boolean;
}

export function ImageCell({ value, onChange, spaceId, editable }: ImageCellProps) {
  const [showModal, setShowModal] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("spaceId", spaceId);
      const res = await fetch("/api/attachments", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload échoué");
      const data = await res.json();
      onChange(data.url);
    } catch (error) {
      console.error('[ImageCell] Upload image échoué:', error);
    } finally {
      setUploading(false);
      setShowInput(false);
    }
  }, [spaceId, onChange]);

  const handleUrlSubmit = useCallback(() => {
    const trimmed = urlInput.trim();
    if (trimmed) {
      onChange(trimmed);
      setUrlInput("");
    }
    setShowInput(false);
  }, [urlInput, onChange]);

  // Thumbnail display when image exists
  if (value) {
    return (
      <>
        <div className="flex items-center gap-1.5 px-2 py-1">
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="shrink-0 rounded overflow-hidden border border-border hover:border-primary transition-colors"
          >
            <Image
              src={value}
              alt=""
              width={48}
              height={48}
              unoptimized
              className="w-12 h-12 object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </button>
          {editable && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-muted-foreground hover:text-destructive transition-colors"
              title="Supprimer l'image"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Zoom modal */}
        {showModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={() => setShowModal(false)}
          >
            <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
              <Image
                src={value}
                alt=""
                width={1200}
                height={900}
                unoptimized
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
              />
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white hover:bg-black/70"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Empty cell — not editable
  if (!editable) return <div className="px-2 py-1 text-muted-foreground text-xs">—</div>;

  // Uploading state
  if (uploading) {
    return (
      <div className="flex items-center justify-center px-2 py-3">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // URL input mode
  if (showInput) {
    return (
      <div className="flex items-center gap-1 px-2 py-1">
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleUrlSubmit(); if (e.key === "Escape") setShowInput(false); }}
          placeholder="https://..."
          className="database-block-cell-input text-xs"
          autoFocus
        />
      </div>
    );
  }

  // Empty cell — upload/URL buttons
  return (
    <div className="flex items-center gap-1 px-2 py-1">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
        }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="text-muted-foreground hover:text-foreground transition-colors"
        title="Charger une image"
      >
        <Upload className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setShowInput(true)}
        className="text-muted-foreground hover:text-foreground transition-colors"
        title="Coller une URL"
      >
        <Link2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

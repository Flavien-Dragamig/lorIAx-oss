"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight, Building2, X, ImageIcon } from "lucide-react";
import type { SetupData } from "@/app/(setup)/setup/page";

interface StepIdentityProps {
  data: SetupData;
  onUpdate: (identity: SetupData["identity"]) => void;
  onNext: () => void;
}

function ImageUpload({
  label,
  hint,
  type,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  type: "logo" | "favicon";
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(value);
  const [uploadError, setUploadError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setUploadError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);

      const res = await fetch("/api/setup/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur");
      }

      const { url } = await res.json();
      setPreview(url);
      onChange(url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Erreur d'upload");
    } finally {
      setUploading(false);
    }
  }

  function handleRemove() {
    setPreview(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground">{hint}</p>

      {preview ? (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt={label}
            className={`rounded bg-white ${type === "favicon" ? "h-8 w-8" : "h-12 max-w-[120px] object-contain"}`}
          />
          <span className="text-sm text-muted-foreground flex-1">Image chargée</span>
          <Button variant="ghost" size="sm" onClick={handleRemove}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-border cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          )}
          <span className="text-sm text-muted-foreground">
            {uploading ? "Envoi en cours..." : "Cliquez pour choisir une image"}
          </span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
    </div>
  );
}

export function StepIdentity({ data, onUpdate, onNext }: StepIdentityProps) {
  const [name, setName] = useState(data.identity.name);
  const [description, setDescription] = useState(data.identity.description);
  const [logoUrl, setLogoUrl] = useState<string | null>(data.identity.logoUrl);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(data.identity.faviconUrl);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleNext() {
    if (!name.trim()) {
      setError("Le nom de l'organisation est obligatoire");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/setup/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          logoUrl,
          faviconUrl,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur");
      }

      onUpdate({
        name: name.trim(),
        description: description.trim(),
        logoUrl,
        faviconUrl,
      });
      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Building2 className="h-12 w-12 text-primary mx-auto mb-3" />
        <h2 className="text-2xl font-bold">Identité de l&apos;organisation</h2>
        <p className="text-muted-foreground mt-1">
          Ces informations seront affichées dans l&apos;interface.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="org-name">Nom de l&apos;organisation *</Label>
          <Input
            id="org-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mon organisation"
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="org-desc">Description courte</Label>
          <textarea
            id="org-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Quelques mots sur votre organisation..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-y"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <ImageUpload
            label="Logo"
            hint="JPG, PNG, WebP ou SVG. Max 2 Mo."
            type="logo"
            value={logoUrl}
            onChange={setLogoUrl}
          />
          <ImageUpload
            label="Favicon"
            hint="Petite icône du navigateur. Sera redimensionnée à 32x32."
            type="favicon"
            value={faviconUrl}
            onChange={setFaviconUrl}
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end">
        <Button onClick={handleNext} disabled={saving} className="gap-2">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          Suivant
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Trash2, X, Loader2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LabelBadge } from "@/components/labels/label-badge";
import { useCurrentUser } from "@/hooks/use-session";

interface LabelItem {
  id: string;
  name: string;
  color: string;
  spaceId: string | null;
  isGlobal: boolean;
  createdAt: string;
}

const PRESET_COLORS = [
  "#ef4444", // rouge
  "#f97316", // orange
  "#eab308", // jaune
  "#22c55e", // vert
  "#3b82f6", // bleu
  "#8b5cf6", // violet
  "#ec4899", // rose
  "#14b8a6", // teal
  "#6b7280", // gris
  "#0ea5e9", // bleu ciel
];

function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5;
}

export function AdminLabelsTab() {
  const user = useCurrentUser();
  const [labels, setLabels] = useState<LabelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6b7280");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchLabels();
  }, []);

  async function fetchLabels() {
    setLoading(true);
    try {
      const res = await fetch("/api/labels");
      const data = await res.json();
      // Ne garder que les labels globaux
      const globalLabels = Array.isArray(data)
        ? data.filter((l: LabelItem) => l.isGlobal)
        : [];
      setLabels(globalLabels);
    } catch {
      toast.error("Erreur lors du chargement des labels");
    }
    setLoading(false);
  }

  function resetForm() {
    setNewName("");
    setNewColor("#6b7280");
    setShowCreate(false);
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), color: newColor, isGlobal: true }),
      });
      if (res.ok) {
        toast.success("Label créé");
        resetForm();
        fetchLabels();
      } else {
        const data = await res.json();
        toast.error(data.error || "Erreur lors de la création");
      }
    } catch {
      toast.error("Erreur réseau");
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce label ? Il sera retiré de tous les documents.")) return;
    try {
      const res = await fetch(`/api/labels/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Label supprimé");
        setLabels((prev) => prev.filter((l) => l.id !== id));
      } else {
        toast.error("Erreur lors de la suppression");
      }
    } catch {
      toast.error("Erreur réseau");
    }
  }

  if (!user || (user.globalRole !== "admin" && user.globalRole !== "super_admin")) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        Accès réservé aux administrateurs.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        Chargement des labels...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Labels globaux</h2>
          <p className="text-sm text-muted-foreground">
            Gérez les labels disponibles dans tous les espaces.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} disabled={showCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau label
        </Button>
      </div>

      {/* Formulaire de création */}
      {showCreate && (
        <div className="p-5 rounded-lg border border-border bg-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Nouveau label</h3>
            <button
              onClick={resetForm}
              className="p-1 rounded cursor-pointer hover:bg-accent active:bg-accent/70 active:translate-y-px transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="label-name">Nom</Label>
            <Input
              id="label-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex : Urgent, En cours, À réviser…"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>

          <div className="space-y-2">
            <Label>Couleur</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setNewColor(color)}
                  className="rounded-full transition-transform hover:scale-110"
                  style={{
                    width: 24,
                    height: 24,
                    backgroundColor: color,
                    outline: newColor === color ? `2px solid ${isLightColor(color) ? "#000" : "#fff"}` : "2px solid transparent",
                    outlineOffset: 2,
                  }}
                  aria-label={color}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div
                className="w-6 h-6 rounded-full border border-border flex-shrink-0"
                style={{ backgroundColor: newColor }}
              />
              <Input
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                placeholder="#6b7280"
                className="font-mono w-32"
                maxLength={7}
              />
              <span className="text-sm text-muted-foreground">Aperçu :</span>
              {newName.trim() && (
                <LabelBadge
                  label={{ id: "preview", name: newName, color: newColor }}
                  size="md"
                />
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={resetForm}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={saving || !newName.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Créer
            </Button>
          </div>
        </div>
      )}

      {/* Liste des labels */}
      {labels.length === 0 && !showCreate && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <Tag className="h-8 w-8 opacity-30" />
          <p className="text-sm">Aucun label global. Créez-en un pour organiser vos documents.</p>
        </div>
      )}

      <div className="space-y-2">
        {labels.map((label) => (
          <div
            key={label.id}
            className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-accent/30 transition-colors"
          >
            <div
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: label.color }}
            />
            <div className="flex-1 min-w-0 flex items-center gap-3">
              <LabelBadge label={label} size="md" />
              <span className="text-xs text-muted-foreground font-mono">{label.color}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => handleDelete(label.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

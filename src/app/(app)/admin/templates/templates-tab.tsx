"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Pencil,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmojiPickerPopover } from "@/components/emoji-picker-popover";

interface Template {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: string | null;
  isGlobal: boolean;
  content: unknown;
  createdAt: string;
}

const defaultCategories = [
  "Général",
  "Réunion",
  "Projet",
  "Commercial",
  "Documentation",
  "Rapport",
  "Procédure",
  "Savoir",
  "Personnel",
  "Résolution",
];

export function AdminTemplatesTab() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Formulaire
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("Général");
  const [formIcon, setFormIcon] = useState("📄");
  const [formContent, setFormContent] = useState("");
  const [formGlobal, setFormGlobal] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    setLoading(true);
    try {
      const res = await fetch("/api/templates");
      const data = await res.json();
      setTemplates(data);
    } catch {
      toast.error("Erreur lors du chargement des templates");
    }
    setLoading(false);
  }

  function resetForm() {
    setFormName("");
    setFormDescription("");
    setFormCategory("Général");
    setFormIcon("📄");
    setFormContent("");
    setFormGlobal(true);
    setEditingId(null);
    setShowCreate(false);
  }

  function startEdit(template: Template) {
    setFormName(template.name);
    setFormDescription(template.description || "");
    setFormCategory(template.category || "Général");
    setFormIcon(template.icon || "📄");
    const tmplContent = template.content as { markdown?: string };
    setFormContent(tmplContent?.markdown || "");
    setFormGlobal(template.isGlobal);
    setEditingId(template.id);
    setShowCreate(true);
  }

  async function handleSave() {
    if (!formName.trim()) return;
    setSaving(true);

    const body = {
      name: formName.trim(),
      description: formDescription.trim() || undefined,
      category: formCategory,
      icon: formIcon,
      isGlobal: formGlobal,
      content: { markdown: formContent },
    };

    try {
      if (editingId) {
        const res = await fetch(`/api/templates/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          toast.success("Template mis à jour");
          resetForm();
          fetchTemplates();
        } else {
          const data = await res.json();
          toast.error(data.error || "Erreur");
        }
      } else {
        const res = await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          toast.success("Template créé");
          resetForm();
          fetchTemplates();
        } else {
          const data = await res.json();
          toast.error(data.error || "Erreur");
        }
      }
    } catch {
      toast.error("Erreur réseau");
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce template ?")) return;
    try {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Template supprimé");
        setTemplates((prev) => prev.filter((t) => t.id !== id));
      }
    } catch {
      toast.error("Erreur réseau");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        Chargement des templates...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Templates de documents</h2>
          <p className="text-sm text-muted-foreground">
            Gérez les modèles de documents disponibles lors de la création.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} disabled={showCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nouveau template
        </Button>
      </div>

      {/* Formulaire de création/édition */}
      {showCreate && (
        <div className="p-5 rounded-lg border border-border bg-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">
              {editingId ? "Modifier le template" : "Nouveau template"}
            </h3>
            <button onClick={resetForm} className="p-1 rounded cursor-pointer hover:bg-accent active:bg-accent/70 active:translate-y-px transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tmpl-name">Nom</Label>
              <Input
                id="tmpl-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="PV de réunion"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tmpl-category">Catégorie</Label>
              <select
                id="tmpl-category"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
              >
                {defaultCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tmpl-desc">Description</Label>
            <Input
              id="tmpl-desc"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Modèle pour les comptes-rendus de réunion"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Icône (emoji)</Label>
              <EmojiPickerPopover
                value={formIcon}
                onChange={(emoji) => setFormIcon(emoji || "📄")}
                size="lg"
                clearable={false}
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="tmpl-global"
                checked={formGlobal}
                onChange={(e) => setFormGlobal(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="tmpl-global" className="text-sm">
                Template global (visible partout)
              </Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tmpl-content">Contenu (Markdown)</Label>
            <textarea
              id="tmpl-content"
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder={"# Titre\n\n## Section 1\n\n- Point 1\n- Point 2\n\n## Conclusion\n"}
              rows={10}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm font-mono resize-y"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={resetForm}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving || !formName.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? "Mettre à jour" : "Créer"}
            </Button>
          </div>
        </div>
      )}

      {/* Liste des templates */}
      {templates.length === 0 && !showCreate && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Aucun template. Créez-en un pour standardiser vos documents.
        </p>
      )}

      <div className="space-y-2">
        {templates.map((tmpl) => (
          <div
            key={tmpl.id}
            className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-accent/30 transition-colors"
          >
            <span className="text-2xl">{tmpl.icon || "📄"}</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium">{tmpl.name}</p>
              <p className="text-sm text-muted-foreground truncate">
                {tmpl.description || "Sans description"}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {tmpl.category && (
                  <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                    {tmpl.category}
                  </span>
                )}
                {tmpl.isGlobal && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    Global
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => startEdit(tmpl)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => handleDelete(tmpl.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

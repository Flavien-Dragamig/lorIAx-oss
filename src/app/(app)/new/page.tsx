"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";

interface SpaceOption {
  id: string;
  name: string;
  slug: string;
  type: string;
}

interface TemplateOption {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
}

export default function NewDocumentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedTemplate = searchParams.get("template");
  const [title, setTitle] = useState("");
  const [selectedSpace, setSelectedSpace] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(preselectedTemplate);
  const [spaces, setSpaces] = useState<SpaceOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/spaces")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSpaces(data);
          // Pre-select personal space, or first space with "perso" in slug
          const personal = data.find((s: SpaceOption) => s.type === "personal" || s.slug.startsWith("perso-"));
          setSelectedSpace(personal?.slug || (data.length > 0 ? data[0].slug : ""));
        }
      });
    fetch("/api/templates")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTemplates(data);
          // Pre-fill title from template name if preselected
          if (preselectedTemplate) {
            const tmpl = data.find((t: TemplateOption) => t.id === preselectedTemplate);
            if (tmpl && !title) setTitle(tmpl.name);
          }
        }
      });
  }, []);

  async function handleCreate() {
    if (!title.trim() || !selectedSpace) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/spaces/${selectedSpace}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content: "",
          templateId: selectedTemplate,
        }),
      });

      const doc = await res.json();
      if (res.ok) {
        router.push(`/s/${selectedSpace}/${doc.id}`);
      } else {
        setError(doc.error || "Erreur lors de la création");
        setLoading(false);
      }
    } catch {
      setError("Erreur réseau");
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="max-w-2xl mx-auto px-8 pt-8 pb-4">
        <h1 className="text-2xl font-bold">Nouveau document</h1>
      </div>

      {/* Ligne titre + bouton — sticky pendant le scroll */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-8 py-3 flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1.5">
              Titre du document
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Mon nouveau document..."
              autoFocus
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-ring"
              onKeyDown={(e) => {
                if (e.key === "Enter" && title.trim()) handleCreate();
              }}
            />
          </div>
          <Button
            onClick={handleCreate}
            disabled={!title.trim() || !selectedSpace || loading}
            className="shrink-0 mb-0.5"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileText className="h-4 w-4 mr-2" />
            )}
            Créer le document
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-8 py-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-1.5">Espace</label>
            <select
              value={selectedSpace}
              onChange={(e) => setSelectedSpace(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {spaces.map((s) => (
                <option key={s.id} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {templates.length > 0 && (() => {
          const categories = Array.from(new Set(templates.map((t) => t.category || "autre")));
          const CATEGORY_LABELS: Record<string, string> = {
            réunion: "Réunion",
            projet: "Projet",
            commercial: "Commercial",
            documentation: "Documentation",
            savoir: "Savoir",
            personnel: "Personnel",
            résolution: "Résolution",
            rapport: "Rapport",
            général: "Général",
            autre: "Autre",
          };
          return (
            <div className="space-y-4">
              <label className="block text-sm font-medium">
                Template (optionnel)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSelectedTemplate(null)}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-sm text-left transition-all ${
                    !selectedTemplate
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <span className="text-lg shrink-0">📄</span>
                  <div>
                    <p className="font-medium">Document vide</p>
                    <p className="text-xs text-muted-foreground">
                      Commencer de zéro
                    </p>
                  </div>
                </button>
              </div>
              {categories.map((cat) => {
                const catTemplates = templates.filter((t) => (t.category || "autre") === cat);
                if (catTemplates.length === 0) return null;
                return (
                  <div key={cat} className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {CATEGORY_LABELS[cat] || cat}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {catTemplates.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setSelectedTemplate(t.id)}
                          className={`flex items-center gap-3 p-3 rounded-lg border text-sm text-left transition-all ${
                            selectedTemplate === t.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/30"
                          }`}
                        >
                          <span className="text-lg shrink-0">{t.icon || "📝"}</span>
                          <div>
                            <p className="font-medium">{t.name}</p>
                            {t.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {t.description}
                              </p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
            {error}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

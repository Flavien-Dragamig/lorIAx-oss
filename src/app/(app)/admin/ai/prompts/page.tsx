"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Loader2,
  FlaskConical,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PromptRow {
  id: string;
  name: string;
  slug: string;
  usageType: string;
  description: string | null;
  isActive: boolean;
  versionCount: number;
  activeVersionNumber: number | null;
  activeVersionCount: number;
  hasAbTest: boolean;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USAGE_TYPE_LABELS: Record<string, string> = {
  chat: "Chat RAG",
  summary_doc: "Résumé document",
  summary_meeting: "Résumé réunion",
  embeddings: "Embeddings",
  playground: "Playground",
};

const USAGE_TYPE_COLORS: Record<string, string> = {
  chat: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  summary_doc: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  summary_meeting: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  embeddings: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  playground: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
};

const USAGE_TYPES_FILTER = [
  { value: "all", label: "Tous" },
  { value: "chat", label: "Chat RAG" },
  { value: "summary_doc", label: "Résumé document" },
  { value: "summary_meeting", label: "Résumé réunion" },
  { value: "embeddings", label: "Embeddings" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminAIPromptsPage() {
  const router = useRouter();
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formUsageType, setFormUsageType] = useState("chat");
  const [formDescription, setFormDescription] = useState("");
  const [formSystemPrompt, setFormSystemPrompt] = useState("");
  const [formUserPromptTemplate, setFormUserPromptTemplate] = useState("");
  const [formChangeNote, setFormChangeNote] = useState("");

  const fetchPrompts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ai/prompts");
      if (res.ok) setPrompts(await res.json());
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  function resetForm() {
    setFormName("");
    setFormSlug("");
    setFormUsageType("chat");
    setFormDescription("");
    setFormSystemPrompt("");
    setFormUserPromptTemplate("");
    setFormChangeNote("");
  }

  function handleNameChange(name: string) {
    setFormName(name);
    setFormSlug(
      name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
    );
  }

  async function createPrompt() {
    if (!formName || !formSlug || !formSystemPrompt || !formChangeNote) return;
    setSaving(true);
    try {
      // Detect variables from templates
      const allText = `${formSystemPrompt} ${formUserPromptTemplate}`;
      const varMatches = allText.match(/\{\{(\w+)\}\}/g) || [];
      const uniqueVars = [...new Set(varMatches.map((m) => m.replace(/[{}]/g, "")))];
      const variables = uniqueVars.map((v) => ({ name: v, description: "" }));

      const res = await fetch("/api/admin/ai/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          slug: formSlug,
          usageType: formUsageType,
          description: formDescription || null,
          systemPrompt: formSystemPrompt,
          userPromptTemplate: formUserPromptTemplate || null,
          variables,
          changeNote: formChangeNote,
        }),
      });
      if (res.ok) {
        setDialogOpen(false);
        resetForm();
        await fetchPrompts();
      }
    } finally {
      setSaving(false);
    }
  }

  const filtered = filter === "all"
    ? prompts
    : prompts.filter((p) => p.usageType === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Prompts</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button
                onClick={() => {
                  resetForm();
                  setDialogOpen(true);
                }}
              />
            }
          >
            <Plus className="h-4 w-4 mr-1" />
            Nouveau prompt
          </DialogTrigger>

          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nouveau prompt</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="text-sm font-medium">Nom</label>
                <input
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={formName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Prompt de chat RAG"
                />
              </div>

              {/* Slug */}
              <div>
                <label className="text-sm font-medium">Slug</label>
                <input
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono text-muted-foreground"
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                  placeholder="prompt-de-chat-rag"
                />
              </div>

              {/* Usage type */}
              <div>
                <label className="text-sm font-medium">Type d&apos;usage</label>
                <select
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={formUsageType}
                  onChange={(e) => setFormUsageType(e.target.value)}
                >
                  {Object.entries(USAGE_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium">Description</label>
                <textarea
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[60px]"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Description du prompt..."
                />
              </div>

              {/* System prompt */}
              <div>
                <label className="text-sm font-medium">System prompt</label>
                <textarea
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono min-h-[120px]"
                  value={formSystemPrompt}
                  onChange={(e) => setFormSystemPrompt(e.target.value)}
                  placeholder="Tu es un assistant..."
                />
              </div>

              {/* User prompt template */}
              <div>
                <label className="text-sm font-medium">Template prompt utilisateur</label>
                <textarea
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono min-h-[80px]"
                  value={formUserPromptTemplate}
                  onChange={(e) => setFormUserPromptTemplate(e.target.value)}
                  placeholder="{{context}}\n\nQuestion: {{question}}"
                />
              </div>

              {/* Change note */}
              <div>
                <label className="text-sm font-medium">Note de changement</label>
                <input
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={formChangeNote}
                  onChange={(e) => setFormChangeNote(e.target.value)}
                  placeholder="Version initiale"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={createPrompt}
                disabled={saving || !formName || !formSystemPrompt || !formChangeNote}
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Créer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Usage type filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {USAGE_TYPES_FILTER.map((ut) => (
          <button
            key={ut.value}
            onClick={() => setFilter(ut.value)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm transition-colors",
              filter === ut.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent"
            )}
          >
            {ut.label}
          </button>
        ))}
      </div>

      {/* Prompts table */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Nom</th>
              <th className="px-4 py-3 text-left font-medium">Type d&apos;usage</th>
              <th className="px-4 py-3 text-center font-medium">Version active</th>
              <th className="px-4 py-3 text-center font-medium">Nb versions</th>
              <th className="px-4 py-3 text-center font-medium">Statut</th>
              <th className="px-4 py-3 text-left font-medium">Dernière modification</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-2">
                    <MessageSquare className="h-8 w-8 opacity-50" />
                    <span>Aucun prompt configuré</span>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => router.push(`/admin/ai/prompts/${p.id}`)}
                  className="border-b last:border-b-0 hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div>
                      <span className="font-medium">{p.name}</span>
                      {p.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {p.description}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-medium",
                        USAGE_TYPE_COLORS[p.usageType] ?? "bg-gray-100 text-gray-700"
                      )}
                    >
                      {USAGE_TYPE_LABELS[p.usageType] ?? p.usageType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-sm">
                    {p.activeVersionNumber ? `v${p.activeVersionNumber}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">{p.versionCount}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-medium",
                          p.isActive
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        )}
                      >
                        {p.isActive ? "Actif" : "Inactif"}
                      </span>
                      {p.hasAbTest && (
                        <span className="rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2.5 py-0.5 text-xs font-medium flex items-center gap-1">
                          <FlaskConical className="h-3 w-3" />
                          A/B
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(p.updatedAt).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

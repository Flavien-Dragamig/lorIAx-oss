"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { RotateCcw, Plus, X, Save } from "lucide-react";
import { defaultAliases } from "@/components/editor/extensions/slash-commands/commands";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AliasMap = Record<string, string[]>;

export function EditorAliasesClient() {
  const [customAliases, setCustomAliases] = useState<AliasMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newAlias, setNewAlias] = useState<Record<string, string>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    fetch("/api/admin/slash-aliases")
      .then((r) => r.json())
      .then((data) => { setCustomAliases(data ?? {}); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function getEffective(title: string): string[] {
    return customAliases[title] ?? defaultAliases[title] ?? [];
  }

  function isCustomized(title: string): boolean {
    return title in customAliases;
  }

  function removeAlias(title: string, alias: string) {
    const current = getEffective(title);
    const next = current.filter((a) => a !== alias);
    setCustomAliases((prev) => ({ ...prev, [title]: next }));
  }

  function addAlias(title: string) {
    const val = (newAlias[title] ?? "").trim().toLowerCase();
    if (!val) return;
    const current = getEffective(title);
    if (current.includes(val)) {
      toast.error("Cet alias existe déjà");
      return;
    }
    setCustomAliases((prev) => ({ ...prev, [title]: [...current, val] }));
    setNewAlias((prev) => ({ ...prev, [title]: "" }));
  }

  function resetToDefault(title: string) {
    setCustomAliases((prev) => {
      const next = { ...prev };
      delete next[title];
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/slash-aliases", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customAliases),
      });
      if (!res.ok) throw new Error();
      toast.success("Alias enregistrés");
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  const commandTitles = Object.keys(defaultAliases);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {commandTitles.length} commandes — {Object.keys(customAliases).length} personnalisée{Object.keys(customAliases).length > 1 ? "s" : ""}
        </p>
        <Button onClick={save} disabled={saving} size="sm" className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground w-40">Commande</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Alias actifs</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground w-48">Ajouter</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {commandTitles.map((title) => {
              const aliases = getEffective(title);
              const modified = isCustomized(title);
              return (
                <tr key={title} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <span className="font-medium text-sm">{title}</span>
                    {modified && (
                      <span className="ml-2 text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
                        modifié
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {aliases.length === 0 && (
                        <span className="text-xs text-muted-foreground italic">aucun alias</span>
                      )}
                      {aliases.map((alias) => (
                        <span
                          key={alias}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-muted border border-border"
                        >
                          {alias}
                          <button
                            onClick={() => removeAlias(title, alias)}
                            className="hover:text-destructive transition-colors"
                            title="Supprimer cet alias"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Input
                        ref={(el) => { inputRefs.current[title] = el; }}
                        value={newAlias[title] ?? ""}
                        onChange={(e) => setNewAlias((prev) => ({ ...prev, [title]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && addAlias(title)}
                        placeholder="nouvel alias…"
                        className="h-7 text-xs"
                      />
                      <button
                        onClick={() => addAlias(title)}
                        className="shrink-0 h-7 w-7 flex items-center justify-center rounded border border-border hover:bg-accent transition-colors"
                        title="Ajouter"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {modified && (
                      <button
                        onClick={() => resetToDefault(title)}
                        className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent transition-colors text-muted-foreground"
                        title="Réinitialiser aux valeurs par défaut"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

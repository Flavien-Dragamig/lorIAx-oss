"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Bot,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Star,
  StarOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface AiProvider {
  id: string;
  name: string;
  displayName: string;
  apiBaseUrl: string | null;
  defaultModel: string | null;
  isEnabled: boolean;
  isDefault: boolean;
  createdAt: string;
}

export function AdminProvidersTab() {
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    displayName: "",
    apiBaseUrl: "",
    apiKeyEnc: "",
    defaultModel: "",
  });

  useEffect(() => {
    fetchProviders();
  }, []);

  async function fetchProviders() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/providers");
      const data = await res.json();
      setProviders(data);
    } catch {
      toast.error("Erreur lors du chargement des providers");
    }
    setLoading(false);
  }

  async function createProvider() {
    if (!form.name.trim() || !form.displayName.trim()) return;
    try {
      const res = await fetch("/api/admin/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        toast.error("Erreur lors de la création");
        return;
      }
      toast.success("Provider créé");
      setForm({ name: "", displayName: "", apiBaseUrl: "", apiKeyEnc: "", defaultModel: "" });
      setShowCreate(false);
      fetchProviders();
    } catch {
      toast.error("Erreur lors de la création");
    }
  }

  async function toggleEnabled(provider: AiProvider) {
    try {
      await fetch("/api/admin/providers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: provider.id, isEnabled: !provider.isEnabled }),
      });
      toast.success(provider.isEnabled ? "Provider désactivé" : "Provider activé");
      fetchProviders();
    } catch {
      toast.error("Erreur");
    }
  }

  async function setDefault(provider: AiProvider) {
    try {
      await fetch("/api/admin/providers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: provider.id, isDefault: true }),
      });
      toast.success(provider.displayName + " défini par défaut");
      fetchProviders();
    } catch {
      toast.error("Erreur");
    }
  }

  async function deleteProvider(id: string, name: string) {
    if (!confirm("Supprimer le provider « " + name + " » ?")) return;
    try {
      await fetch("/api/admin/providers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      toast.success("Provider supprimé");
      fetchProviders();
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Providers IA</h2>
          <p className="text-sm text-muted-foreground">
            Configurez les fournisseurs d&apos;intelligence artificielle (Claude, OpenAI, Ollama...).
          </p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger render={<Button size="sm" className="gap-2" />}>
            <Plus className="h-4 w-4" />
            Ajouter un provider
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau provider IA</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Identifiant (ex: claude, openai, ollama)
                </label>
                <Input
                  value={form.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, name: e.target.value })}
                  placeholder="claude"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Nom d&apos;affichage</label>
                <Input
                  value={form.displayName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, displayName: e.target.value })}
                  placeholder="Claude (Anthropic)"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">URL de l&apos;API (optionnel)</label>
                <Input
                  value={form.apiBaseUrl}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, apiBaseUrl: e.target.value })}
                  placeholder="https://api.anthropic.com"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Clé API (optionnel)</label>
                <Input
                  type="password"
                  value={form.apiKeyEnc}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, apiKeyEnc: e.target.value })}
                  placeholder="sk-..."
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Modèle par défaut (optionnel)</label>
                <Input
                  value={form.defaultModel}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, defaultModel: e.target.value })}
                  placeholder="claude-sonnet-4-20250514"
                />
              </div>
              <Button
                onClick={createProvider}
                disabled={!form.name.trim() || !form.displayName.trim()}
                className="w-full"
              >
                Ajouter
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {providers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Bot className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-1">Aucun provider configuré</h3>
          <p className="text-sm text-muted-foreground">
            Ajoutez un provider IA pour activer le chat et le résumé automatique.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {providers.map((p) => (
            <div
              key={p.id}
              className={"bg-card border rounded-lg p-4 flex items-center justify-between transition-colors " + (p.isDefault ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30")}
            >
              <div className="flex items-center gap-4">
                <div className={"h-10 w-10 rounded-lg flex items-center justify-center " + (p.isEnabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{p.displayName}</h3>
                    {p.isDefault && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">par défaut</span>
                    )}
                    {!p.isEnabled && (
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">désactivé</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {p.name}{p.defaultModel ? " — " + p.defaultModel : ""}{p.apiBaseUrl ? " — " + p.apiBaseUrl : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => toggleEnabled(p)} title={p.isEnabled ? "Désactiver" : "Activer"}>
                  {p.isEnabled ? <ToggleRight className="h-5 w-5 text-primary" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDefault(p)} disabled={p.isDefault} title="Définir par défaut">
                  {p.isDefault ? <Star className="h-4 w-4 text-primary fill-primary" /> : <StarOff className="h-4 w-4 text-muted-foreground" />}
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteProvider(p.id, p.displayName)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

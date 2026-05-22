"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  Zap,
  Search,
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

interface Provider {
  id: string;
  name: string;
  displayName: string;
  connectorType: "anthropic" | "openai_compatible" | "mistral";
  apiBaseUrl: string | null;
  defaultModel: string | null;
  isEnabled: boolean;
  isDefault: boolean;
  pricing: { input_cost_per_1k?: number; output_cost_per_1k?: number } | null;
  icon: string | null;
  color: string | null;
  config: Record<string, unknown> | null;
  createdAt: string;
}

interface Assignment {
  id: string;
  usageType: string;
  providerId: string;
  model: string;
  fallbackProviderId: string | null;
  fallbackModel: string | null;
  timeoutSeconds: number;
  maxRetries: number;
  isEnabled: boolean;
}

type ConnectorType = "anthropic" | "openai_compatible" | "mistral";

interface ProviderForm {
  id?: string;
  name: string;
  displayName: string;
  connectorType: ConnectorType;
  apiBaseUrl: string;
  apiKey: string;
  defaultModel: string;
  pricing: { input_cost_per_1k: number; output_cost_per_1k: number };
  icon: string;
  color: string;
}

const EMPTY_FORM: ProviderForm = {
  name: "",
  displayName: "",
  connectorType: "openai_compatible",
  apiBaseUrl: "http://localhost:11434/v1",
  apiKey: "",
  defaultModel: "",
  pricing: { input_cost_per_1k: 0, output_cost_per_1k: 0 },
  icon: "",
  color: "#6366f1",
};

const CONNECTOR_LABELS: Record<ConnectorType, string> = {
  anthropic: "Anthropic",
  openai_compatible: "Compatible OpenAI",
  mistral: "Mistral AI",
};

const USAGE_TYPES = [
  { value: "chat", label: "Chat RAG" },
  { value: "summary_doc", label: "Résumé document" },
  { value: "summary_meeting", label: "Résumé réunion" },
  { value: "embeddings", label: "Embeddings" },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminAIProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<ProviderForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latency?: number;
    response?: string;
    error?: string;
  } | null>(null);
  const [detectingModels, setDetectingModels] = useState(false);
  const [detectedModels, setDetectedModels] = useState<string[]>([]);

  // --- Data fetching ---

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ai/providers");
      if (res.ok) setProviders(await res.json());
    } catch {
      // silently fail
    }
  }, []);

  const fetchAssignments = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ai/assignments");
      if (res.ok) setAssignments(await res.json());
    } catch {
      // silently fail
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchProviders(), fetchAssignments()]);
    setLoading(false);
  }, [fetchProviders, fetchAssignments]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // --- Provider CRUD ---

  function openCreateDialog() {
    setForm(EMPTY_FORM);
    setTestResult(null);
    setDetectedModels([]);
    setDialogOpen(true);
  }

  function openEditDialog(p: Provider) {
    setForm({
      id: p.id,
      name: p.name,
      displayName: p.displayName,
      connectorType: p.connectorType,
      apiBaseUrl: p.apiBaseUrl || "",
      apiKey: "", // Never show the encrypted key
      defaultModel: p.defaultModel || "",
      pricing: {
        input_cost_per_1k: (p.pricing as ProviderForm["pricing"])?.input_cost_per_1k || 0,
        output_cost_per_1k: (p.pricing as ProviderForm["pricing"])?.output_cost_per_1k || 0,
      },
      icon: p.icon || "",
      color: p.color || "#6366f1",
    });
    setTestResult(null);
    setDetectedModels([]);
    setDialogOpen(true);
  }

  async function saveProvider() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        displayName: form.displayName,
        connectorType: form.connectorType,
        apiBaseUrl: form.apiBaseUrl || null,
        defaultModel: form.defaultModel || null,
        pricing: form.pricing,
        icon: form.icon || null,
        color: form.color || null,
      };

      if (form.apiKey) {
        payload.apiKeyEnc = form.apiKey;
      }

      if (form.id) {
        // Update
        payload.id = form.id;
        await fetch("/api/admin/ai/providers", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        // Create
        await fetch("/api/admin/ai/providers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      setDialogOpen(false);
      await fetchProviders();
    } finally {
      setSaving(false);
    }
  }

  async function deleteProvider(id: string) {
    if (!confirm("Supprimer ce fournisseur ?")) return;
    await fetch("/api/admin/ai/providers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await fetchProviders();
  }

  async function toggleEnabled(p: Provider) {
    await fetch("/api/admin/ai/providers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, isEnabled: !p.isEnabled }),
    });
    await fetchProviders();
  }

  async function setAsDefault(p: Provider) {
    await fetch("/api/admin/ai/providers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, isDefault: true }),
    });
    await fetchProviders();
  }

  // --- Test connection ---

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/ai/providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectorType: form.connectorType,
          apiBaseUrl: form.apiBaseUrl,
          apiKey: form.apiKey,
          model: form.defaultModel,
        }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ success: false, error: "Erreur réseau" });
    } finally {
      setTesting(false);
    }
  }

  // --- Auto-detect models ---

  async function detectModels() {
    setDetectingModels(true);
    setDetectedModels([]);
    try {
      const res = await fetch("/api/admin/ai/providers/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiBaseUrl: form.apiBaseUrl,
          apiKey: form.apiKey,
          connectorType: form.connectorType,
        }),
      });
      const data = await res.json();
      if (data.models) {
        setDetectedModels(data.models);
      }
    } catch {
      // silently fail
    } finally {
      setDetectingModels(false);
    }
  }

  // --- Assignments ---

  function getAssignment(usageType: string): Assignment | undefined {
    return assignments.find((a) => a.usageType === usageType);
  }

  async function saveAssignment(
    usageType: string,
    updates: Partial<Assignment>
  ) {
    const existing = getAssignment(usageType);
    const payload = {
      usageType,
      providerId: updates.providerId ?? existing?.providerId ?? providers[0]?.id,
      model: updates.model ?? existing?.model ?? "",
      fallbackProviderId:
        updates.fallbackProviderId !== undefined
          ? updates.fallbackProviderId
          : existing?.fallbackProviderId ?? null,
      fallbackModel:
        updates.fallbackModel !== undefined
          ? updates.fallbackModel
          : existing?.fallbackModel ?? null,
      timeoutSeconds:
        updates.timeoutSeconds ?? existing?.timeoutSeconds ?? 30,
      maxRetries: updates.maxRetries ?? existing?.maxRetries ?? 1,
      isEnabled: updates.isEnabled ?? existing?.isEnabled ?? true,
    };

    if (!payload.providerId || !payload.model) return;

    await fetch("/api/admin/ai/assignments", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await fetchAssignments();
  }

  // --- Render ---

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ================================================================ */}
      {/* SECTION 1: Fournisseurs                                         */}
      {/* ================================================================ */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Fournisseurs IA</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger
              render={<Button onClick={openCreateDialog} />}
            >
              <Plus className="h-4 w-4 mr-1" />
              Ajouter un fournisseur
            </DialogTrigger>

            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {form.id ? "Modifier le fournisseur" : "Nouveau fournisseur"}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Display name */}
                <div>
                  <label className="text-sm font-medium">
                    Nom d&apos;affichage
                  </label>
                  <input
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={form.displayName}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        displayName: e.target.value,
                        name: e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")
                          .replace(/(^-|-$)/g, ""),
                      }))
                    }
                    placeholder="Ollama local"
                  />
                </div>

                {/* Connector type */}
                <div>
                  <label className="text-sm font-medium">Connecteur</label>
                  <div className="mt-1 flex gap-4">
                    {(
                      Object.entries(CONNECTOR_LABELS) as [
                        ConnectorType,
                        string
                      ][]
                    ).map(([value, label]) => (
                      <label
                        key={value}
                        className="flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="connectorType"
                          value={value}
                          checked={form.connectorType === value}
                          onChange={() => {
                            let baseUrl = "http://localhost:11434/v1";
                            if (value === "anthropic") baseUrl = "https://api.anthropic.com";
                            if (value === "mistral") baseUrl = "https://api.mistral.ai";
                            setForm((f) => ({
                              ...f,
                              connectorType: value,
                              apiBaseUrl: baseUrl,
                            }));
                          }}
                          className="accent-primary"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                {/* API Base URL */}
                <div>
                  <label className="text-sm font-medium">URL de base</label>
                  <input
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
                    value={form.apiBaseUrl}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, apiBaseUrl: e.target.value }))
                    }
                    placeholder="http://localhost:11434/v1"
                  />
                </div>

                {/* API Key */}
                <div>
                  <label className="text-sm font-medium">Clé API</label>
                  <input
                    type="password"
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={form.apiKey}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, apiKey: e.target.value }))
                    }
                    placeholder={
                      form.id
                        ? "Laisser vide pour conserver l'actuelle"
                        : "sk-..."
                    }
                  />
                </div>

                {/* Default model */}
                <div>
                  <label className="text-sm font-medium">
                    Modèle par défaut
                  </label>
                  <div className="mt-1 flex gap-2">
                    <input
                      className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                      value={form.defaultModel}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          defaultModel: e.target.value,
                        }))
                      }
                      placeholder="gemma4:e4b"
                      list="detected-models"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={detectModels}
                      disabled={detectingModels || !form.apiBaseUrl}
                      title="Détecter les modèles disponibles"
                    >
                      {detectingModels ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {detectedModels.length > 0 && (
                    <datalist id="detected-models">
                      {detectedModels.map((m) => (
                        <option key={m} value={m} />
                      ))}
                    </datalist>
                  )}
                  {detectedModels.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {detectedModels.map((m) => (
                        <button
                          key={m}
                          type="button"
                          className={cn(
                            "rounded-md border px-2 py-0.5 text-xs transition-colors",
                            form.defaultModel === m
                              ? "border-primary bg-primary/10 text-primary"
                              : "hover:bg-accent"
                          )}
                          onClick={() =>
                            setForm((f) => ({ ...f, defaultModel: m }))
                          }
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pricing */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">
                      Coût entrée / 1k tokens
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={form.pricing.input_cost_per_1k}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          pricing: {
                            ...f.pricing,
                            input_cost_per_1k: parseFloat(e.target.value) || 0,
                          },
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">
                      Coût sortie / 1k tokens
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={form.pricing.output_cost_per_1k}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          pricing: {
                            ...f.pricing,
                            output_cost_per_1k:
                              parseFloat(e.target.value) || 0,
                          },
                        }))
                      }
                    />
                  </div>
                </div>

                {/* Icon + Color */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Icône (emoji)</label>
                    <input
                      className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={form.icon}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, icon: e.target.value }))
                      }
                      placeholder="🤖"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Couleur</label>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="color"
                        className="h-9 w-12 rounded-md border cursor-pointer"
                        value={form.color}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, color: e.target.value }))
                        }
                      />
                      <span className="text-sm font-mono text-muted-foreground">
                        {form.color}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Test connection */}
                <div className="rounded-md border p-3 space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={testConnection}
                    disabled={testing || !form.defaultModel}
                  >
                    {testing ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Zap className="h-4 w-4 mr-1" />
                    )}
                    Tester la connexion
                  </Button>
                  {testResult && (
                    <div
                      className={cn(
                        "flex items-center gap-2 text-sm",
                        testResult.success
                          ? "text-green-600"
                          : "text-red-600"
                      )}
                    >
                      {testResult.success ? (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          Connexion réussie — {testResult.latency} ms
                          {testResult.response && (
                            <span className="text-muted-foreground">
                              ({testResult.response})
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4" />
                          {testResult.error}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Annuler
                </Button>
                <Button
                  onClick={saveProvider}
                  disabled={saving || !form.displayName || !form.name}
                >
                  {saving && (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  )}
                  {form.id ? "Enregistrer" : "Créer"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Providers table */}
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Nom</th>
                <th className="px-4 py-3 text-left font-medium">Connecteur</th>
                <th className="px-4 py-3 text-left font-medium">URL</th>
                <th className="px-4 py-3 text-left font-medium">
                  Modèle par défaut
                </th>
                <th className="px-4 py-3 text-left font-medium">Statut</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {providers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    Aucun fournisseur configuré
                  </td>
                </tr>
              ) : (
                providers.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {p.icon && <span>{p.icon}</span>}
                        {p.color && (
                          <span
                            className="inline-block h-3 w-3 rounded-full"
                            style={{ backgroundColor: p.color }}
                          />
                        )}
                        <span className="font-medium">{p.displayName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {CONNECTOR_LABELS[p.connectorType]}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground max-w-48 truncate">
                      {p.apiBaseUrl || "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {p.defaultModel || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleEnabled(p)}
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
                            p.isEnabled
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          )}
                        >
                          {p.isEnabled ? "Actif" : "Inactif"}
                        </button>
                        {p.isDefault ? (
                          <span className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium">
                            Par défaut
                          </span>
                        ) : (
                          <button
                            onClick={() => setAsDefault(p)}
                            className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-accent transition-colors"
                          >
                            Définir par défaut
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => openEditDialog(p)}
                          title="Modifier"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => deleteProvider(p.id)}
                          title="Supprimer"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ================================================================ */}
      {/* SECTION 2: Assignation modèle par usage                         */}
      {/* ================================================================ */}
      <section>
        <h2 className="text-xl font-bold mb-4">
          Assignation modèle par usage
        </h2>

        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Usage</th>
                <th className="px-4 py-3 text-left font-medium">
                  Fournisseur principal
                </th>
                <th className="px-4 py-3 text-left font-medium">Modèle</th>
                <th className="px-4 py-3 text-left font-medium">
                  Fallback fournisseur
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  Fallback modèle
                </th>
                <th className="px-4 py-3 text-left font-medium">Timeout</th>
                <th className="px-4 py-3 text-center font-medium">Actif</th>
                <th className="px-4 py-3 text-center font-medium">
                  <span className="sr-only">Sauvegarder</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {USAGE_TYPES.map((ut) => (
                <AssignmentRow
                  key={ut.value}
                  usageType={ut.value}
                  label={ut.label}
                  providers={providers}
                  assignment={getAssignment(ut.value)}
                  onSave={(updates) => saveAssignment(ut.value, updates)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AssignmentRow — editable row for each usage type
// ---------------------------------------------------------------------------

function AssignmentRow({
  usageType: _usageType,
  label,
  providers,
  assignment,
  onSave,
}: {
  usageType: string;
  label: string;
  providers: Provider[];
  assignment: Assignment | undefined;
  onSave: (updates: Partial<Assignment>) => Promise<void>;
}) {
  const [providerId, setProviderId] = useState(
    assignment?.providerId || ""
  );
  const [model, setModel] = useState(assignment?.model || "");
  const [fallbackProviderId, setFallbackProviderId] = useState(
    assignment?.fallbackProviderId || ""
  );
  const [fallbackModel, setFallbackModel] = useState(
    assignment?.fallbackModel || ""
  );
  const [timeout, setTimeoutValue] = useState(
    assignment?.timeoutSeconds ?? 30
  );
  const [isEnabled, setIsEnabled] = useState(
    assignment?.isEnabled ?? true
  );
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Sync when assignment changes from parent
  useEffect(() => {
    setProviderId(assignment?.providerId || "");
    setModel(assignment?.model || "");
    setFallbackProviderId(assignment?.fallbackProviderId || "");
    setFallbackModel(assignment?.fallbackModel || "");
    setTimeoutValue(assignment?.timeoutSeconds ?? 30);
    setIsEnabled(assignment?.isEnabled ?? true);
    setDirty(false);
  }, [assignment]);

  async function handleSave() {
    setSaving(true);
    await onSave({
      providerId,
      model,
      fallbackProviderId: fallbackProviderId || null,
      fallbackModel: fallbackModel || null,
      timeoutSeconds: timeout,
      isEnabled,
    });
    setDirty(false);
    setSaving(false);
  }

  function markDirty() {
    setDirty(true);
  }

  return (
    <tr className="border-b last:border-b-0">
      <td className="px-4 py-3 font-medium">{label}</td>

      {/* Provider principal */}
      <td className="px-4 py-2">
        <select
          className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          value={providerId}
          onChange={(e) => {
            setProviderId(e.target.value);
            markDirty();
          }}
        >
          <option value="">—</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName}
            </option>
          ))}
        </select>
      </td>

      {/* Modèle */}
      <td className="px-4 py-2">
        <input
          className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          value={model}
          onChange={(e) => {
            setModel(e.target.value);
            markDirty();
          }}
          placeholder="gemma4:e4b"
        />
      </td>

      {/* Fallback provider */}
      <td className="px-4 py-2">
        <select
          className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          value={fallbackProviderId}
          onChange={(e) => {
            setFallbackProviderId(e.target.value);
            markDirty();
          }}
        >
          <option value="">Aucun</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName}
            </option>
          ))}
        </select>
      </td>

      {/* Fallback modèle */}
      <td className="px-4 py-2">
        <input
          className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          value={fallbackModel}
          onChange={(e) => {
            setFallbackModel(e.target.value);
            markDirty();
          }}
          placeholder="—"
        />
      </td>

      {/* Timeout */}
      <td className="px-4 py-2">
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={5}
            max={300}
            className="w-16 rounded-md border bg-background px-2 py-1.5 text-sm text-right"
            value={timeout}
            onChange={(e) => {
              setTimeoutValue(parseInt(e.target.value) || 30);
              markDirty();
            }}
          />
          <span className="text-xs text-muted-foreground">s</span>
        </div>
      </td>

      {/* Toggle actif */}
      <td className="px-4 py-2 text-center">
        <button
          onClick={() => {
            setIsEnabled(!isEnabled);
            markDirty();
          }}
          className={cn(
            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
            isEnabled ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
          )}
        >
          <span
            className={cn(
              "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
              isEnabled ? "translate-x-4.5" : "translate-x-0.5"
            )}
          />
        </button>
      </td>

      {/* Save */}
      <td className="px-4 py-2 text-center">
        <Button
          variant="outline"
          size="icon-xs"
          onClick={handleSave}
          disabled={!dirty || saving || !providerId || !model}
          title="Sauvegarder"
        >
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
        </Button>
      </td>
    </tr>
  );
}

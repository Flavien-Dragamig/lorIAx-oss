"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  Key,
  Plus,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  AlertTriangle,
  Clock,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ALL_SCOPES = [
  { value: "documents:read", label: "Documents (lecture)", group: "Documents" },
  { value: "documents:write", label: "Documents (écriture)", group: "Documents" },
  { value: "spaces:read", label: "Espaces (lecture)", group: "Espaces" },
  { value: "spaces:write", label: "Espaces (écriture)", group: "Espaces" },
  { value: "search", label: "Recherche", group: "Autre" },
  { value: "webhooks", label: "Webhooks", group: "Autre" },
] as const;

const EXPIRATION_OPTIONS = [
  { value: 0, label: "Pas d'expiration" },
  { value: 30, label: "30 jours" },
  { value: 90, label: "90 jours" },
  { value: 180, label: "180 jours" },
  { value: 365, label: "1 an" },
];

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export function ApiKeysTab() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>([]);
  const [newKeyExpiration, setNewKeyExpiration] = useState(0);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadKeys();
  }, []);

  async function loadKeys() {
    try {
      const res = await fetch("/api/user/api-keys");
      if (res.ok) {
        const data = await res.json();
        setKeys(data);
      }
    } catch {
      toast.error("Erreur de chargement des clés API");
    }
    setLoading(false);
  }

  function openForm() {
    setShowForm(true);
    setNewKeyName("");
    setNewKeyScopes([]);
    setNewKeyExpiration(0);
    setCreatedKey(null);
    setTimeout(() => nameRef.current?.focus(), 50);
  }

  function toggleScope(scope: string) {
    setNewKeyScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  }

  function selectAllScopes() {
    if (newKeyScopes.length === ALL_SCOPES.length) {
      setNewKeyScopes([]);
    } else {
      setNewKeyScopes(ALL_SCOPES.map((s) => s.value));
    }
  }

  async function createKey() {
    if (!newKeyName.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    if (newKeyScopes.length === 0) {
      toast.error("Sélectionnez au moins un scope");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/user/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newKeyName.trim(),
          scopes: newKeyScopes,
          expiresInDays: newKeyExpiration || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCreatedKey(data.key);
        setShowKey(true);
        toast.success("Clé API créée");
        loadKeys();
      } else {
        const err = await res.json();
        toast.error(err.error || "Erreur lors de la création");
      }
    } catch {
      toast.error("Erreur lors de la création");
    }
    setCreating(false);
  }

  async function revokeKey(keyId: string, keyName: string) {
    setRevoking(keyId);
    try {
      const res = await fetch(`/api/user/api-keys?id=${keyId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(`Clé « ${keyName} » révoquée`);
        loadKeys();
      } else {
        toast.error("Erreur lors de la révocation");
      }
    } catch {
      toast.error("Erreur lors de la révocation");
    }
    setRevoking(null);
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copié dans le presse-papiers");
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function formatRelativeDate(dateStr: string | null) {
    if (!dateStr) return "Jamais";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    const diffH = Math.floor(diffMs / 3_600_000);
    const diffD = Math.floor(diffMs / 86_400_000);

    if (diffMin < 1) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    if (diffH < 24) return `Il y a ${diffH}h`;
    if (diffD < 30) return `Il y a ${diffD}j`;
    return formatDate(dateStr);
  }

  function isExpired(expiresAt: string | null) {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  }

  const scopeLabels: Record<string, string> = {
    "documents:read": "docs:r",
    "documents:write": "docs:w",
    "spaces:read": "spaces:r",
    "spaces:write": "spaces:w",
    search: "search",
    webhooks: "webhooks",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Description */}
      <div className="bg-card border border-border rounded-lg p-4">
        <p className="text-sm text-muted-foreground">
          Les clés API permettent d&apos;accéder à l&apos;API LorIAx depuis des
          applications externes. Chaque clé est associée à des permissions
          (scopes) et peut avoir une date d&apos;expiration.
        </p>
      </div>

      {/* Created key alert */}
      {createdKey && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                Copiez cette clé maintenant — elle ne sera plus visible après.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm bg-white dark:bg-gray-900 border border-amber-300 dark:border-amber-700 rounded px-3 py-2 font-mono break-all">
                  {showKey ? createdKey : "•".repeat(40)}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => copyToClipboard(createdKey)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCreatedKey(null);
                setShowForm(false);
              }}
            >
              Compris, fermer
            </Button>
          </div>
        </div>
      )}

      {/* Create form */}
      {showForm && !createdKey && (
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h3 className="text-sm font-semibold">Nouvelle clé API</h3>

          <div>
            <label className="text-sm font-medium mb-1 block">Nom</label>
            <Input
              ref={nameRef}
              value={newKeyName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNewKeyName(e.target.value)
              }
              placeholder="Ex : Script d'import, CI/CD, Application mobile..."
              className="max-w-md"
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === "Escape") setShowForm(false);
              }}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Permissions</label>
              <button
                onClick={selectAllScopes}
                className="text-xs text-primary hover:underline"
              >
                {newKeyScopes.length === ALL_SCOPES.length
                  ? "Tout désélectionner"
                  : "Tout sélectionner"}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {ALL_SCOPES.map((scope) => (
                <label
                  key={scope.value}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    newKeyScopes.includes(scope.value)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={newKeyScopes.includes(scope.value)}
                    onChange={() => toggleScope(scope.value)}
                    className="rounded"
                  />
                  <span className="text-sm">{scope.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Expiration</label>
            <select
              value={newKeyExpiration}
              onChange={(e) => setNewKeyExpiration(Number(e.target.value))}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm max-w-md w-full"
            >
              {EXPIRATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button onClick={createKey} disabled={creating} className="gap-2">
              <Key className="h-4 w-4" />
              {creating ? "Création..." : "Créer la clé"}
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              Annuler
            </Button>
          </div>
        </div>
      )}

      {/* Keys list */}
      <div className="bg-card border border-border rounded-lg">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-sm font-semibold">
            Clés actives ({keys.length}/20)
          </h3>
          {!showForm && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={openForm}
              disabled={keys.length >= 20}
            >
              <Plus className="h-3.5 w-3.5" />
              Nouvelle clé
            </Button>
          )}
        </div>

        {keys.length === 0 ? (
          <div className="p-8 text-center">
            <Key className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Aucune clé API. Créez-en une pour accéder à l&apos;API LorIAx.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {keys.map((key) => {
              const expired = isExpired(key.expiresAt);
              return (
                <div
                  key={key.id}
                  className={`p-4 flex items-start gap-4 ${expired ? "opacity-60" : ""}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{key.name}</span>
                      {expired && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                          Expirée
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                      <code className="bg-muted px-1.5 py-0.5 rounded font-mono">
                        {key.keyPrefix}...
                      </code>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Créée le {formatDate(key.createdAt)}
                      </span>
                      {key.expiresAt && (
                        <span>
                          Expire le {formatDate(key.expiresAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Shield className="h-3 w-3 text-muted-foreground" />
                      <div className="flex gap-1 flex-wrap">
                        {(key.scopes as string[]).map((scope) => (
                          <span
                            key={scope}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono"
                          >
                            {scopeLabels[scope] || scope}
                          </span>
                        ))}
                      </div>
                    </div>
                    {key.lastUsedAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Dernière utilisation : {formatRelativeDate(key.lastUsedAt)}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5 shrink-0"
                    onClick={() => revokeKey(key.id, key.name)}
                    disabled={revoking === key.id}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {revoking === key.id ? "..." : "Révoquer"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

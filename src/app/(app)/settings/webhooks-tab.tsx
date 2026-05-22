"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  Webhook,
  Plus,
  Copy,
  Trash2,
  AlertTriangle,
  Eye,
  EyeOff,
  Check,
  X,
  Play,
  ChevronDown,
  ChevronRight,
  Circle,
  RefreshCw,
  Power,
  PowerOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const WEBHOOK_EVENTS = [
  { value: "document.created", label: "Document créé", group: "Documents" },
  { value: "document.updated", label: "Document modifié", group: "Documents" },
  { value: "document.deleted", label: "Document supprimé", group: "Documents" },
  { value: "comment.created", label: "Commentaire ajouté", group: "Commentaires" },
  { value: "comment.resolved", label: "Commentaire résolu", group: "Commentaires" },
  { value: "space.member_added", label: "Membre ajouté", group: "Espaces" },
  { value: "space.member_removed", label: "Membre retiré", group: "Espaces" },
  { value: "mention.created", label: "Mention créée", group: "Mentions" },
] as const;

interface WebhookData {
  id: string;
  url: string;
  events: string[];
  spaceId: string | null;
  active: boolean;
  failureCount: number;
  secret?: string;
  createdAt: string;
  updatedAt: string;
}

interface Delivery {
  id: string;
  eventType: string;
  statusCode: number | null;
  attempts: number;
  deliveredAt: string | null;
  createdAt: string;
}

interface Space {
  id: string;
  name: string;
  slug: string;
}

export function WebhooksTab() {
  const [webhooksList, setWebhooksList] = useState<WebhookData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newEvents, setNewEvents] = useState<string[]>([]);
  const [newSpaceId, setNewSpaceId] = useState("");
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [expandedWebhook, setExpandedWebhook] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Record<string, Delivery[]>>({});
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [testing, setTesting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const urlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadWebhooks();
    loadSpaces();
  }, []);

  async function loadWebhooks() {
    try {
      const res = await fetch("/api/v1/webhooks");
      if (res.ok) {
        const json = await res.json();
        setWebhooksList(json.data || []);
      }
    } catch {
      toast.error("Erreur de chargement des webhooks");
    }
    setLoading(false);
  }

  async function loadSpaces() {
    try {
      const res = await fetch("/api/spaces");
      if (res.ok) {
        const data = await res.json();
        setSpaces(data);
      }
    } catch {
      // Non-blocking
    }
  }

  async function loadDeliveries(webhookId: string) {
    try {
      const res = await fetch(`/api/v1/webhooks/${webhookId}`);
      if (res.ok) {
        const json = await res.json();
        setDeliveries((prev) => ({
          ...prev,
          [webhookId]: json.data?.deliveries || [],
        }));
      }
    } catch {
      toast.error("Erreur de chargement de l'historique");
    }
  }

  function openForm() {
    setShowForm(true);
    setNewUrl("");
    setNewEvents([]);
    setNewSpaceId("");
    setCreatedSecret(null);
    setTimeout(() => urlRef.current?.focus(), 50);
  }

  function toggleEvent(event: string) {
    setNewEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  }

  function selectAllEvents() {
    if (newEvents.length === WEBHOOK_EVENTS.length) {
      setNewEvents([]);
    } else {
      setNewEvents(WEBHOOK_EVENTS.map((e) => e.value));
    }
  }

  async function createWebhook() {
    if (!newUrl.trim()) {
      toast.error("L'URL est requise");
      return;
    }
    if (newEvents.length === 0) {
      toast.error("Sélectionnez au moins un événement");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/v1/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: newUrl.trim(),
          events: newEvents,
          spaceId: newSpaceId || undefined,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setCreatedSecret(json.data?.secret || null);
        setShowSecret(true);
        toast.success("Webhook créé");
        loadWebhooks();
      } else {
        const json = await res.json();
        toast.error(json.error || "Erreur lors de la création");
      }
    } catch {
      toast.error("Erreur lors de la création");
    }
    setCreating(false);
  }

  async function toggleWebhook(webhook: WebhookData) {
    setToggling(webhook.id);
    try {
      const res = await fetch(`/api/v1/webhooks/${webhook.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !webhook.active }),
      });
      if (res.ok) {
        toast.success(webhook.active ? "Webhook désactivé" : "Webhook activé");
        loadWebhooks();
      }
    } catch {
      toast.error("Erreur lors de la modification");
    }
    setToggling(null);
  }

  async function testWebhook(webhookId: string) {
    setTesting(webhookId);
    try {
      const res = await fetch(`/api/v1/webhooks/${webhookId}/test`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success("Événement test envoyé");
        // Reload deliveries after a short delay
        setTimeout(() => loadDeliveries(webhookId), 2000);
      } else {
        toast.error("Erreur lors du test");
      }
    } catch {
      toast.error("Erreur lors du test");
    }
    setTesting(null);
  }

  async function deleteWebhook(webhookId: string) {
    setDeleting(webhookId);
    try {
      const res = await fetch(`/api/v1/webhooks/${webhookId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Webhook supprimé");
        loadWebhooks();
      }
    } catch {
      toast.error("Erreur lors de la suppression");
    }
    setDeleting(null);
  }

  function toggleExpand(webhookId: string) {
    if (expandedWebhook === webhookId) {
      setExpandedWebhook(null);
    } else {
      setExpandedWebhook(webhookId);
      if (!deliveries[webhookId]) {
        loadDeliveries(webhookId);
      }
    }
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
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function statusBadge(code: number | null) {
    if (code === null) return "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30";
    if (code >= 200 && code < 300) return "text-green-600 bg-green-100 dark:bg-green-900/30";
    return "text-red-600 bg-red-100 dark:bg-red-900/30";
  }

  const eventLabels: Record<string, string> = {};
  WEBHOOK_EVENTS.forEach((e) => { eventLabels[e.value] = e.label; });

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
          Les webhooks envoient des notifications HTTP à vos applications
          lorsque des événements se produisent dans LorIAx. Chaque livraison
          est signée avec un secret HMAC-SHA256.
        </p>
      </div>

      {/* Created secret alert */}
      {createdSecret && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                Copiez ce secret maintenant — il ne sera plus visible après.
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
                Utilisez ce secret pour vérifier la signature{" "}
                <code className="bg-white/50 dark:bg-black/20 px-1 rounded">
                  X-LorIAx-Signature
                </code>{" "}
                de chaque livraison.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm bg-white dark:bg-gray-900 border border-amber-300 dark:border-amber-700 rounded px-3 py-2 font-mono break-all">
                  {showSecret ? createdSecret : "•".repeat(40)}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => setShowSecret(!showSecret)}
                >
                  {showSecret ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => copyToClipboard(createdSecret)}
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
                setCreatedSecret(null);
                setShowForm(false);
              }}
            >
              Compris, fermer
            </Button>
          </div>
        </div>
      )}

      {/* Create form */}
      {showForm && !createdSecret && (
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h3 className="text-sm font-semibold">Nouveau webhook</h3>

          <div>
            <label className="text-sm font-medium mb-1 block">
              URL de destination
            </label>
            <Input
              ref={urlRef}
              value={newUrl}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNewUrl(e.target.value)
              }
              placeholder="https://example.com/webhooks/loriax"
              className="max-w-lg"
              type="url"
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === "Escape") setShowForm(false);
              }}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Événements</label>
              <button
                onClick={selectAllEvents}
                className="text-xs text-primary hover:underline"
              >
                {newEvents.length === WEBHOOK_EVENTS.length
                  ? "Tout désélectionner"
                  : "Tout sélectionner"}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {WEBHOOK_EVENTS.map((event) => (
                <label
                  key={event.value}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    newEvents.includes(event.value)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={newEvents.includes(event.value)}
                    onChange={() => toggleEvent(event.value)}
                    className="rounded"
                  />
                  <span className="text-sm">{event.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">
              Filtrer par espace (optionnel)
            </label>
            <select
              value={newSpaceId}
              onChange={(e) => setNewSpaceId(e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm max-w-md w-full"
            >
              <option value="">Tous les espaces</option>
              {spaces.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Si sélectionné, seuls les événements de cet espace déclencheront
              le webhook.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button
              onClick={createWebhook}
              disabled={creating}
              className="gap-2"
            >
              <Webhook className="h-4 w-4" />
              {creating ? "Création..." : "Créer le webhook"}
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              Annuler
            </Button>
          </div>
        </div>
      )}

      {/* Webhooks list */}
      <div className="bg-card border border-border rounded-lg">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-sm font-semibold">
            Webhooks ({webhooksList.length}/20)
          </h3>
          {!showForm && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={openForm}
              disabled={webhooksList.length >= 20}
            >
              <Plus className="h-3.5 w-3.5" />
              Nouveau webhook
            </Button>
          )}
        </div>

        {webhooksList.length === 0 ? (
          <div className="p-8 text-center">
            <Webhook className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Aucun webhook configuré. Créez-en un pour recevoir des
              notifications.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {webhooksList.map((webhook) => (
              <div key={webhook.id}>
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Expand toggle */}
                    <button
                      onClick={() => toggleExpand(webhook.id)}
                      className="mt-0.5 text-muted-foreground hover:text-foreground"
                    >
                      {expandedWebhook === webhook.id ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>

                    {/* Status indicator */}
                    <Circle
                      className={`h-3 w-3 mt-1.5 shrink-0 ${
                        webhook.active
                          ? webhook.failureCount > 0
                            ? "text-yellow-500 fill-yellow-500"
                            : "text-green-500 fill-green-500"
                          : "text-gray-400 fill-gray-400"
                      }`}
                    />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-sm font-mono truncate">
                          {webhook.url}
                        </code>
                        {!webhook.active && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                            Désactivé
                          </span>
                        )}
                        {webhook.failureCount >= 5 && webhook.active && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
                            {webhook.failureCount} échecs
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1 flex-wrap mb-1">
                        {(webhook.events as string[]).map((event) => (
                          <span
                            key={event}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                          >
                            {eventLabels[event] || event}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Créé le {formatDate(webhook.createdAt)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => toggleWebhook(webhook)}
                        disabled={toggling === webhook.id}
                        title={webhook.active ? "Désactiver" : "Activer"}
                      >
                        {webhook.active ? (
                          <Power className="h-3.5 w-3.5" />
                        ) : (
                          <PowerOff className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => testWebhook(webhook.id)}
                        disabled={testing === webhook.id || !webhook.active}
                        title="Envoyer un test"
                      >
                        {testing === webhook.id ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => deleteWebhook(webhook.id)}
                        disabled={deleting === webhook.id}
                        title="Supprimer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Deliveries */}
                {expandedWebhook === webhook.id && (
                  <div className="border-t border-border bg-muted/30 px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Dernières livraisons
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs gap-1"
                        onClick={() => loadDeliveries(webhook.id)}
                      >
                        <RefreshCw className="h-3 w-3" />
                        Actualiser
                      </Button>
                    </div>
                    {!deliveries[webhook.id] ? (
                      <p className="text-xs text-muted-foreground py-2 animate-pulse">
                        Chargement...
                      </p>
                    ) : deliveries[webhook.id].length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">
                        Aucune livraison enregistrée.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {deliveries[webhook.id].map((delivery) => (
                          <div
                            key={delivery.id}
                            className="flex items-center gap-3 text-xs bg-background rounded px-3 py-2 border border-border"
                          >
                            <span
                              className={`px-1.5 py-0.5 rounded font-mono font-medium ${statusBadge(delivery.statusCode)}`}
                            >
                              {delivery.statusCode || "ERR"}
                            </span>
                            <span className="text-muted-foreground">
                              {eventLabels[delivery.eventType] || delivery.eventType}
                            </span>
                            <span className="text-muted-foreground ml-auto">
                              {delivery.deliveredAt ? (
                                <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                  <Check className="h-3 w-3" />
                                  Livré
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                                  <X className="h-3 w-3" />
                                  Échec
                                </span>
                              )}
                            </span>
                            <span className="text-muted-foreground">
                              {formatDate(delivery.createdAt)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Trash2,
  X,
  Upload,
  Download,
  RefreshCw,
  Globe,
  FileSpreadsheet,
  Settings2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { SyncMapping } from "./types";

// ─── Sync Config Panel ──────────────────────────────────────────────────────

export function SyncConfigPanel({
  databaseId,
  onRefresh,
}: {
  databaseId: string;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mappings, setMappings] = useState<SyncMapping[]>([]);
  const [_loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [provider, setProvider] = useState<"airtable" | "notion">("airtable");
  const [externalId, setExternalId] = useState("");
  const [credentials, setCredentials] = useState("");
  const [syncMode, setSyncMode] = useState("manual");
  const [syncInterval, setSyncInterval] = useState(0);
  const [configuring, setConfiguring] = useState(false);

  const loadMappings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/databases/${databaseId}/sync`);
      if (res.ok) {
        const data = await res.json();
        setMappings(data.mappings || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [databaseId]);

  useEffect(() => {
    if (open) loadMappings();
  }, [open, loadMappings]);

  async function handleConfigure() {
    if (!externalId || !credentials) return;
    setConfiguring(true);
    setError(null);
    try {
      const res = await fetch(`/api/databases/${databaseId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "configure",
          provider,
          externalId,
          credentials,
          syncMode,
          syncIntervalMin: syncInterval || null,
          columnMapping: [],
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur de configuration");
      }
      setExternalId("");
      setCredentials("");
      toast.success("Source configurée");
      await loadMappings();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur";
      setError(msg);
      toast.error(msg);
    } finally {
      setConfiguring(false);
    }
  }

  async function handleSync(mappingId: string, action: "pull" | "push" | "sync") {
    setSyncing(mappingId);
    setError(null);
    try {
      const res = await fetch(`/api/databases/${databaseId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, mappingId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de sync");
      toast.success("Synchronisation terminée");
      await loadMappings();
      onRefresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur";
      setError(msg);
      toast.error(msg);
    } finally {
      setSyncing(null);
    }
  }

  async function handleDelete(mappingId: string) {
    try {
      const res = await fetch(`/api/databases/${databaseId}/sync`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappingId }),
      });
      if (res.ok) {
        toast.success("Source supprimée");
      } else {
        toast.error("Erreur lors de la suppression");
      }
      await loadMappings();
    } catch {
      toast.error("Erreur réseau");
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:bg-accent transition-colors"
        title="Synchronisation externe"
      >
        <RefreshCw className="h-3.5 w-3.5" />
      </button>
    );
  }

  return (
    <div className="absolute right-0 top-full mt-1 z-50 w-96 rounded-lg border border-border bg-popover shadow-lg p-3">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium flex items-center gap-1.5">
          <RefreshCw className="h-4 w-4" />
          Synchronisation externe
        </h4>
        <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-accent">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 mb-3 p-2 rounded bg-destructive/10 text-destructive text-xs">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Mappings existants */}
      {mappings.length > 0 && (
        <div className="space-y-2 mb-3">
          {mappings.map((m) => (
            <div key={m.id} className="p-2 rounded border border-border bg-muted/30">
              <div className="flex items-center gap-2 mb-1">
                {m.provider === "airtable" ? (
                  <Globe className="h-3.5 w-3.5 text-yellow-600" />
                ) : (
                  <FileSpreadsheet className="h-3.5 w-3.5 text-blue-600" />
                )}
                <span className="text-xs font-medium capitalize">{m.provider}</span>
                <span className="text-[10px] text-muted-foreground truncate flex-1">{m.externalId}</span>
                <button
                  onClick={() => handleDelete(m.id)}
                  className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>

              <div className="flex items-center gap-1 mb-1">
                <button
                  onClick={() => handleSync(m.id, "pull")}
                  disabled={syncing === m.id}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {syncing === m.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                  Pull
                </button>
                <button
                  onClick={() => handleSync(m.id, "push")}
                  disabled={syncing === m.id}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-muted hover:bg-accent disabled:opacity-50"
                >
                  <Upload className="h-3 w-3" />
                  Push
                </button>
                <button
                  onClick={() => handleSync(m.id, "sync")}
                  disabled={syncing === m.id}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-muted hover:bg-accent disabled:opacity-50"
                >
                  <RefreshCw className="h-3 w-3" />
                  Sync
                </button>
              </div>

              {m.lastSyncAt && (
                <div className="text-[10px] text-muted-foreground">
                  Dernière sync : {new Date(m.lastSyncAt).toLocaleString("fr-FR")} ({m.lastSyncDirection})
                </div>
              )}
              {m.syncError && (
                <div className="text-[10px] text-destructive mt-0.5">{m.syncError}</div>
              )}

              {/* Derniers logs */}
              {m.logs.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {m.logs.slice(0, 3).map((log) => (
                    <div key={log.id} className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <span className={log.status === "success" ? "text-green-600" : log.status === "error" ? "text-destructive" : "text-amber-600"}>
                        {log.status === "success" ? "OK" : log.status === "error" ? "Err" : "..."}
                      </span>
                      <span>{log.direction}</span>
                      <span>+{log.rowsCreated} ~{log.rowsUpdated} -{log.rowsDeleted}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Formulaire d'ajout */}
      <div className="space-y-2 border-t border-border pt-2">
        <div className="text-xs font-medium text-muted-foreground">Ajouter une source</div>

        <div className="flex gap-1">
          <button
            onClick={() => setProvider("airtable")}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
              provider === "airtable" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent"
            }`}
          >
            <Globe className="h-3 w-3" />
            Airtable
          </button>
          <button
            onClick={() => setProvider("notion")}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
              provider === "notion" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent"
            }`}
          >
            <FileSpreadsheet className="h-3 w-3" />
            Notion
          </button>
        </div>

        <input
          type="text"
          value={externalId}
          onChange={(e) => setExternalId(e.target.value)}
          placeholder={provider === "airtable" ? "baseId/tableId" : "database_id Notion"}
          className="w-full px-2 py-1 text-xs rounded border border-input bg-background"
        />
        <input
          type="password"
          value={credentials}
          onChange={(e) => setCredentials(e.target.value)}
          placeholder={provider === "airtable" ? "Token Airtable (pat_...)" : "Token Notion (ntn_...)"}
          className="w-full px-2 py-1 text-xs rounded border border-input bg-background"
        />

        <div className="flex items-center gap-2">
          <select
            value={syncMode}
            onChange={(e) => setSyncMode(e.target.value)}
            className="px-2 py-1 text-xs rounded border border-input bg-background"
          >
            <option value="manual">Manuel</option>
            <option value="pull">Auto-pull</option>
            <option value="bidirectional">Bidirectionnel</option>
          </select>
          {syncMode !== "manual" && (
            <select
              value={syncInterval}
              onChange={(e) => setSyncInterval(parseInt(e.target.value))}
              className="px-2 py-1 text-xs rounded border border-input bg-background"
            >
              <option value={5}>5 min</option>
              <option value={15}>15 min</option>
              <option value={60}>1 heure</option>
              <option value={360}>6 heures</option>
            </select>
          )}
        </div>

        <button
          onClick={handleConfigure}
          disabled={configuring || !externalId || !credentials}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {configuring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Settings2 className="h-3.5 w-3.5" />}
          Configurer
        </button>
      </div>
    </div>
  );
}

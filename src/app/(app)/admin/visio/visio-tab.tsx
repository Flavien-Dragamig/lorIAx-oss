"use client";

import { useState, useEffect, useCallback } from "react";
import { Video, Loader2, Settings } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type VisioAction =
  | "join_immediate"
  | "join_scheduled_invited"
  | "join_scheduled_uninvited"
  | "create_immediate"
  | "create_scheduled"
  | "modify_cancel";

type Role = "viewer" | "editor";

const ACTION_LABELS: Record<VisioAction, string> = {
  join_immediate: "Rejoindre une réunion immédiate",
  join_scheduled_invited: "Rejoindre une réunion planifiée (invité)",
  join_scheduled_uninvited: "Rejoindre une réunion planifiée (sans invitation)",
  create_immediate: "Créer une réunion immédiate",
  create_scheduled: "Planifier une réunion",
  modify_cancel: "Modifier / annuler une réunion",
};

const ACTIONS = Object.keys(ACTION_LABELS) as VisioAction[];
const ROLES: Role[] = ["viewer", "editor"];

type Matrix = Record<VisioAction, Record<Role | "admin", boolean>>;

interface LiveKitSettings {
  livekitEnabled: boolean;
  livekitUrl: string;
  livekitEgressPath: string;
  livekitApiKey: string;
  livekitApiSecret: string;
}

export function AdminVisioTab() {
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [livekit, setLivekit] = useState<LiveKitSettings>({
    livekitEnabled: true,
    livekitUrl: "ws://localhost:7880",
    livekitEgressPath: "/recordings",
    livekitApiKey: "",
    livekitApiSecret: "",
  });
  const [livekitSaving, setLivekitSaving] = useState(false);

  const fetchMatrix = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/visio-permissions");
      if (res.ok) {
        setMatrix(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatrix();
  }, [fetchMatrix]);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.livekit) setLivekit((prev) => ({ ...prev, ...data.livekit }));
      })
      .catch(() => {});
  }, []);

  const handleToggle = async (action: VisioAction, role: Role) => {
    if (!matrix) return;

    const current = matrix[action][role];
    const newValue = !current;

    setMatrix((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [action]: { ...prev[action], [role]: newValue },
      };
    });

    try {
      const res = await fetch("/api/admin/visio-permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spaceId: null,
          action,
          role,
          allowed: newValue,
        }),
      });

      if (!res.ok) {
        setMatrix((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            [action]: { ...prev[action], [role]: current },
          };
        });
        toast.error("Erreur lors de la mise à jour");
      }
    } catch {
      setMatrix((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          [action]: { ...prev[action], [role]: current },
        };
      });
    }
  };

  async function handleLivekitSave() {
    setLivekitSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ livekit }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Paramètres LiveKit enregistrés");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLivekitSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!matrix) return null;

  return (
    <div className="max-w-3xl space-y-8">
      {/* Matrice des permissions */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Video className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">Permissions visio</h2>
            <p className="text-sm text-muted-foreground">
              Configuration globale des permissions de visioconférence par rôle.
              Les administrateurs ont toujours accès.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-4 py-3 font-medium">Action</th>
                <th className="text-center px-4 py-3 font-medium w-24">Lecteur</th>
                <th className="text-center px-4 py-3 font-medium w-24">Éditeur</th>
                <th className="text-center px-4 py-3 font-medium w-24">Admin</th>
              </tr>
            </thead>
            <tbody>
              {ACTIONS.map((action) => (
                <tr key={action} className="border-t border-border">
                  <td className="px-4 py-3">{ACTION_LABELS[action]}</td>
                  {ROLES.map((role) => (
                    <td key={role} className="text-center px-4 py-3">
                      <input
                        type="checkbox"
                        checked={matrix[action][role]}
                        onChange={() => handleToggle(action, role)}
                        className="rounded"
                      />
                    </td>
                  ))}
                  <td className="text-center px-4 py-3">
                    <input
                      type="checkbox"
                      checked
                      disabled
                      className="rounded opacity-50"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          Le créateur d&apos;une réunion peut toujours la modifier ou l&apos;annuler, indépendamment de cette matrice.
          Ces permissions peuvent être surchargées au niveau de chaque espace.
        </p>
      </div>

      {/* Configuration LiveKit */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium">Configuration LiveKit</h3>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Activer la visioconférence</p>
            <p className="text-xs text-muted-foreground">
              Permet de lancer des réunions vidéo depuis l&apos;éditeur et la page réunions
            </p>
          </div>
          <button
            onClick={() => setLivekit((p) => ({ ...p, livekitEnabled: !p.livekitEnabled }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              livekit.livekitEnabled ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                livekit.livekitEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {livekit.livekitEnabled && (
          <div className="grid grid-cols-2 gap-4 p-4 rounded-lg border border-border bg-muted/30">
            <div className="space-y-2">
              <Label htmlFor="lk-url">URL WebSocket</Label>
              <Input
                id="lk-url"
                value={livekit.livekitUrl}
                onChange={(e) => setLivekit((p) => ({ ...p, livekitUrl: e.target.value }))}
                placeholder="ws://localhost:7880"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lk-egress">Chemin Egress</Label>
              <Input
                id="lk-egress"
                value={livekit.livekitEgressPath}
                onChange={(e) => setLivekit((p) => ({ ...p, livekitEgressPath: e.target.value }))}
                placeholder="/recordings"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lk-key">API Key</Label>
              <Input
                id="lk-key"
                type="password"
                value={livekit.livekitApiKey}
                onChange={(e) => setLivekit((p) => ({ ...p, livekitApiKey: e.target.value }))}
                placeholder="devkey"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lk-secret">API Secret</Label>
              <Input
                id="lk-secret"
                type="password"
                value={livekit.livekitApiSecret}
                onChange={(e) => setLivekit((p) => ({ ...p, livekitApiSecret: e.target.value }))}
                placeholder="devsecret"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={handleLivekitSave} disabled={livekitSaving} size="sm">
            {livekitSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enregistrer
          </Button>
        </div>
      </section>
    </div>
  );
}

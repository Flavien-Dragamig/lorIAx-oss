"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TelemetryState {
  enabled: boolean;
  contactEmail: string | null;
  instanceId: string | null;
}

export function TelemetryTab() {
  const [state, setState] = useState<TelemetryState>({
    enabled: false,
    contactEmail: null,
    instanceId: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/telemetry");
      if (res.ok) setState(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/telemetry", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: state.enabled,
          contactEmail: state.contactEmail?.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Échec de l'enregistrement");
        return;
      }
      setState(await res.json());
      toast.success("Réglages de télémétrie enregistrés");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Radio className="h-5 w-5" />
        <h1 className="text-xl font-semibold">Télémétrie</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        En activant la télémétrie, cette instance envoie chaque semaine un
        rapport anonyme (version, nombre d&apos;utilisateurs, d&apos;organisations
        et d&apos;espaces) à licences.loriax.fr. Aucune donnée nominative
        n&apos;est transmise. L&apos;email de contact est facultatif et sert
        uniquement à vous joindre.
      </p>

      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={state.enabled}
          onChange={(e) =>
            setState((s) => ({ ...s, enabled: e.target.checked }))
          }
        />
        <span className="text-sm">Activer la télémétrie hebdomadaire</span>
      </label>

      <div className="space-y-2">
        <Label htmlFor="telemetry-email">Email de contact (facultatif)</Label>
        <Input
          id="telemetry-email"
          type="email"
          value={state.contactEmail ?? ""}
          onChange={(e) =>
            setState((s) => ({ ...s, contactEmail: e.target.value }))
          }
          placeholder="admin@votre-organisation.fr"
        />
      </div>

      {state.instanceId && (
        <p className="text-xs text-muted-foreground">
          Identifiant d&apos;instance : <code>{state.instanceId}</code>
        </p>
      )}

      <Button onClick={save} disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Enregistrer
      </Button>
    </div>
  );
}

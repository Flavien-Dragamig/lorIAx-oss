"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  ShieldCheck,
  Server,
  Bell,
  Database,
  Loader2,
  Save,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// --- Types ---

interface AIGlobalSettings {
  enabled: boolean;
}

interface RolePermissions {
  viewer: { canUseAI: boolean; canUsePlayground: boolean; canViewLogs: boolean };
  editor: { canUseAI: boolean; canUsePlayground: boolean; canViewLogs: boolean };
  admin: { canUseAI: boolean; canUsePlayground: boolean; canViewLogs: boolean };
}

interface WhisperSettings {
  whisperEnabled: boolean;
  whisperApiUrl: string;
  whisperModel: string;
  whisperLanguage: string;
  whisperDiarize: boolean;
}

interface TranscriptionSettings {
  engine: "whisper" | "voxtral";
  vocabulary: string;
}

interface VoxtralSettings {
  voxtralEnabled: boolean;
  voxtralApiUrl: string;
  voxtralModel: string;
  voxtralLanguage: string;
}

interface OllamaSettings {
  ollamaEnabled: boolean;
  ollamaBaseUrl: string;
  ollamaDefaultModel: string;
}

interface AIAlertsSettings {
  thresholdWarning: number;
  thresholdCritical: number;
  notificationEmail: string;
}

interface LogRetentionSettings {
  retentionDays: number;
  storeContent: boolean;
}

// --- Toggle component ---

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

// --- Defaults ---

const DEFAULT_AI_GLOBAL: AIGlobalSettings = { enabled: true };

const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  viewer: { canUseAI: false, canUsePlayground: false, canViewLogs: false },
  editor: { canUseAI: true, canUsePlayground: false, canViewLogs: false },
  admin: { canUseAI: true, canUsePlayground: true, canViewLogs: true },
};

const DEFAULT_TRANSCRIPTION: TranscriptionSettings = {
  engine: "whisper",
  vocabulary: "",
};

const DEFAULT_WHISPER: WhisperSettings = {
  whisperEnabled: false,
  whisperApiUrl: "http://localhost:9000",
  whisperModel: "Systran/faster-whisper-medium",
  whisperLanguage: "fr",
  whisperDiarize: false,
};

const DEFAULT_VOXTRAL: VoxtralSettings = {
  voxtralEnabled: false,
  voxtralApiUrl: "http://localhost:9001",
  voxtralModel: "mistralai/Voxtral-Mini-Latest",
  voxtralLanguage: "fr",
};

const DEFAULT_OLLAMA: OllamaSettings = {
  ollamaEnabled: false,
  ollamaBaseUrl: "http://localhost:11434",
  ollamaDefaultModel: "gemma4:e4b",
};

const DEFAULT_ALERTS: AIAlertsSettings = {
  thresholdWarning: 80,
  thresholdCritical: 100,
  notificationEmail: "",
};

const DEFAULT_RETENTION: LogRetentionSettings = {
  retentionDays: 90,
  storeContent: true,
};

// --- Labels ---

const ROLE_LABELS: Record<string, string> = {
  viewer: "Lecteur",
  editor: "Éditeur",
  admin: "Administrateur",
};

const PERMISSION_LABELS: Record<string, string> = {
  canUseAI: "Utiliser l'IA",
  canUsePlayground: "Playground",
  canViewLogs: "Voir les logs",
};

const WHISPER_MODELS = [
  { value: "Systran/faster-whisper-tiny", label: "Tiny (39M — rapide, qualité limitée)" },
  { value: "Systran/faster-whisper-base", label: "Base (74M — basique)" },
  { value: "Systran/faster-whisper-small", label: "Small (244M — bon compromis)" },
  { value: "Systran/faster-whisper-medium", label: "Medium (769M — recommandé FR)" },
  { value: "Systran/faster-whisper-large-v3", label: "Large v3 (1.5G — meilleure qualité)" },
];
const TRANSCRIPTION_LANGUAGES = [
  { value: "fr", label: "Français" },
  { value: "en", label: "Anglais" },
  { value: "de", label: "Allemand" },
  { value: "es", label: "Espagnol" },
  { value: "it", label: "Italien" },
];
const WHISPER_LANGUAGES = TRANSCRIPTION_LANGUAGES;

const VOXTRAL_MODELS = [
  { value: "mistralai/Voxtral-Mini-4B-Realtime-2602", label: "Voxtral Mini 4B Realtime (GPU >= 16 Go)" },
];

// --- Service health test ---

interface HealthResult {
  status: "up" | "down";
  latency?: number;
}

function HealthBadge({ result }: { result?: HealthResult }) {
  if (!result) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      {result.status === "up" ? (
        <>
          <Wifi className="h-3 w-3 text-green-500" />
          <span className="text-green-600">
            En ligne{result.latency ? ` (${result.latency} ms)` : ""}
          </span>
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3 text-red-500" />
          <span className="text-red-600">Hors ligne</span>
        </>
      )}
    </span>
  );
}

// --- Main component ---

export default function AdminAISettingsPage() {
  const [aiGlobal, setAiGlobal] = useState<AIGlobalSettings>(DEFAULT_AI_GLOBAL);
  const [rolePermissions, setRolePermissions] = useState<RolePermissions>(DEFAULT_ROLE_PERMISSIONS);
  const [transcription, setTranscription] = useState<TranscriptionSettings>(DEFAULT_TRANSCRIPTION);
  const [whisper, setWhisper] = useState<WhisperSettings>(DEFAULT_WHISPER);
  const [voxtral, setVoxtral] = useState<VoxtralSettings>(DEFAULT_VOXTRAL);
  const [ollama, setOllama] = useState<OllamaSettings>(DEFAULT_OLLAMA);
  const [alerts, setAlerts] = useState<AIAlertsSettings>(DEFAULT_ALERTS);
  const [retention, setRetention] = useState<LogRetentionSettings>(DEFAULT_RETENTION);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [healthResults, setHealthResults] = useState<Record<string, HealthResult>>({});
  const [testingHealth, setTestingHealth] = useState<Record<string, boolean>>({});

  // Load settings
  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ai/settings");
      if (!res.ok) return;
      const data = await res.json();

      if (data.ai_global) setAiGlobal((prev) => ({ ...prev, ...data.ai_global }));
      if (data.rolePermissions) {
        setRolePermissions((prev) => {
          const merged = { ...prev };
          for (const role of ["viewer", "editor", "admin"] as const) {
            if (data.rolePermissions[role]) {
              merged[role] = { ...prev[role], ...data.rolePermissions[role] };
            }
          }
          return merged;
        });
      }
      if (data.transcription) setTranscription((prev) => ({ ...prev, ...data.transcription }));
      if (data.whisper) setWhisper((prev) => ({ ...prev, ...data.whisper }));
      if (data.voxtral) setVoxtral((prev) => ({ ...prev, ...data.voxtral }));
      if (data.ollama) setOllama((prev) => ({ ...prev, ...data.ollama }));
      if (data.ai_alerts) {
        const a = data.ai_alerts;
        setAlerts((prev) => ({ ...prev, ...a }));
        if (a.retention) {
          setRetention((prev) => ({ ...prev, ...a.retention }));
        }
      }
    } catch (err) {
      console.error("Failed to load AI settings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Save
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/ai/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ai_global: aiGlobal,
          rolePermissions,
          transcription,
          whisper,
          voxtral,
          ollama,
          ai_alerts: {
            ...alerts,
            retention,
          },
        }),
      });
      if (res.ok) {
        toast.success("Réglages IA enregistrés");
      } else {
        const data = await res.json();
        throw new Error(data.error || "Erreur");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  // Test connection
  const testConnection = async (service: "whisper" | "ollama" | "voxtral") => {
    setTestingHealth((prev) => ({ ...prev, [service]: true }));
    try {
      if (service === "voxtral") {
        // Direct health check for Voxtral
        const start = Date.now();
        const res = await fetch(`${voxtral.voxtralApiUrl}/health`);
        const latency = Date.now() - start;
        if (res.ok) {
          setHealthResults((prev) => ({
            ...prev,
            voxtral: { status: "up", latency },
          }));
        } else {
          setHealthResults((prev) => ({
            ...prev,
            voxtral: { status: "down" },
          }));
        }
      } else {
        const res = await fetch("/api/admin/services/health");
        if (res.ok) {
          const data = await res.json();
          if (data[service]) {
            setHealthResults((prev) => ({ ...prev, [service]: data[service] }));
          } else {
            setHealthResults((prev) => ({
              ...prev,
              [service]: { status: "down" },
            }));
          }
        } else {
          setHealthResults((prev) => ({
            ...prev,
            [service]: { status: "down" },
          }));
        }
      }
    } catch {
      setHealthResults((prev) => ({
        ...prev,
        [service]: { status: "down" },
      }));
    } finally {
      setTestingHealth((prev) => ({ ...prev, [service]: false }));
    }
  };

  // Role permission toggle
  const toggleRolePerm = (
    role: "viewer" | "editor" | "admin",
    perm: "canUseAI" | "canUsePlayground" | "canViewLogs"
  ) => {
    setRolePermissions((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [perm]: !prev[role][perm],
      },
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Réglages IA</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configuration globale de l&apos;intelligence artificielle, des services externes et des alertes.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Enregistrer
        </Button>
      </div>

      {/* 1. Acces et permissions */}
      <div className="rounded-lg border bg-card p-6 space-y-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold">Accès et permissions</h3>
        </div>

        {/* Kill switch */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Activer l&apos;IA globalement</p>
            <p className="text-xs text-muted-foreground">
              Désactive toutes les fonctionnalités IA pour l&apos;ensemble des utilisateurs
            </p>
          </div>
          <Toggle checked={aiGlobal.enabled} onChange={(v) => setAiGlobal({ enabled: v })} />
        </div>

        {/* Role permissions table */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Permissions par rôle</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Rôle</th>
                  {Object.keys(PERMISSION_LABELS).map((perm) => (
                    <th
                      key={perm}
                      className="text-center py-2 px-4 font-medium text-muted-foreground"
                    >
                      {PERMISSION_LABELS[perm]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(["viewer", "editor", "admin"] as const).map((role) => (
                  <tr key={role} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-medium">{ROLE_LABELS[role]}</td>
                    {(["canUseAI", "canUsePlayground", "canViewLogs"] as const).map((perm) => (
                      <td key={perm} className="text-center py-3 px-4">
                        <Toggle
                          checked={rolePermissions[role][perm]}
                          onChange={() => toggleRolePerm(role, perm)}
                          disabled={!aiGlobal.enabled}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 2. Services externes */}
      <div className="rounded-lg border bg-card p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Server className="h-5 w-5 text-purple-500" />
          <h3 className="text-lg font-semibold">Services externes</h3>
        </div>

        {/* Moteur de transcription */}
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium">Moteur de transcription</p>
            <p className="text-xs text-muted-foreground">
              Choisissez le service utilisé pour la transcription audio vers texte
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTranscription({ ...transcription, engine: "whisper" })}
              className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                transcription.engine === "whisper"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-transparent text-muted-foreground hover:bg-muted/50"
              }`}
            >
              Faster-Whisper (CPU)
            </button>
            <button
              type="button"
              onClick={() => setTranscription({ ...transcription, engine: "voxtral" })}
              className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                transcription.engine === "voxtral"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-transparent text-muted-foreground hover:bg-muted/50"
              }`}
            >
              Voxtral Realtime (GPU)
            </button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="transcription-vocabulary">Vocabulaire métier</Label>
            <textarea
              id="transcription-vocabulary"
              value={transcription.vocabulary}
              onChange={(e) =>
                setTranscription({ ...transcription, vocabulary: e.target.value })
              }
              placeholder="LorIAx, Dokploy, Hocuspocus, MasterProject, Ollama"
              rows={3}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground">
              Noms propres, acronymes et termes spécifiques à votre organisation.
              Séparez-les par des virgules. Améliore la reconnaissance des mots peu courants.
              Partagé entre tous les moteurs de transcription.
            </p>
          </div>
        </div>

        {/* Whisper */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">Faster-Whisper (transcription CPU)</p>
              {transcription.engine === "whisper" && (
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded">Actif</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <HealthBadge result={healthResults.whisper} />
              <Toggle
                checked={whisper.whisperEnabled}
                onChange={(v) => setWhisper({ ...whisper, whisperEnabled: v })}
              />
            </div>
          </div>

          {whisper.whisperEnabled && (
            <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="whisper-url">URL du service</Label>
                  <Input
                    id="whisper-url"
                    value={whisper.whisperApiUrl}
                    onChange={(e) =>
                      setWhisper({ ...whisper, whisperApiUrl: e.target.value })
                    }
                    placeholder="http://localhost:9000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whisper-model">Modèle</Label>
                  <select
                    id="whisper-model"
                    value={whisper.whisperModel}
                    onChange={(e) =>
                      setWhisper({ ...whisper, whisperModel: e.target.value })
                    }
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {WHISPER_MODELS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whisper-lang">Langue</Label>
                  <select
                    id="whisper-lang"
                    value={whisper.whisperLanguage}
                    onChange={(e) =>
                      setWhisper({ ...whisper, whisperLanguage: e.target.value })
                    }
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {WHISPER_LANGUAGES.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between pt-6">
                  <Label htmlFor="whisper-diarize">Diarisation (identification des locuteurs)</Label>
                  <Toggle
                    checked={whisper.whisperDiarize}
                    onChange={(v) => setWhisper({ ...whisper, whisperDiarize: v })}
                  />
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => testConnection("whisper")}
                disabled={testingHealth.whisper}
              >
                {testingHealth.whisper ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Wifi className="h-4 w-4 mr-2" />
                )}
                Tester la connexion
              </Button>
            </div>
          )}
        </div>

        {/* Voxtral */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">Voxtral Realtime (transcription GPU)</p>
              {transcription.engine === "voxtral" && (
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded">Actif</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <HealthBadge result={healthResults.voxtral} />
              <Toggle
                checked={voxtral.voxtralEnabled}
                onChange={(v) => setVoxtral({ ...voxtral, voxtralEnabled: v })}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Mistral Voxtral Mini 4B Realtime — transcription temps réel via vLLM.
            Requiert un GPU NVIDIA avec au moins 16 Go de VRAM.
          </p>

          {voxtral.voxtralEnabled && (
            <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
              {healthResults.voxtral?.status !== "up" && (
                <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2">
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    Service Voxtral non joignable. Vérifiez que le profil Docker
                    <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded mx-1">voxtral</code>
                    est lancé et qu&apos;un GPU est disponible.
                    En attendant, Whisper prend le relais automatiquement.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="voxtral-url">URL du service</Label>
                  <Input
                    id="voxtral-url"
                    value={voxtral.voxtralApiUrl}
                    onChange={(e) =>
                      setVoxtral({ ...voxtral, voxtralApiUrl: e.target.value })
                    }
                    placeholder="http://localhost:9001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="voxtral-model">Modèle</Label>
                  <select
                    id="voxtral-model"
                    value={voxtral.voxtralModel}
                    onChange={(e) =>
                      setVoxtral({ ...voxtral, voxtralModel: e.target.value })
                    }
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {VOXTRAL_MODELS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="voxtral-lang">Langue</Label>
                  <select
                    id="voxtral-lang"
                    value={voxtral.voxtralLanguage}
                    onChange={(e) =>
                      setVoxtral({ ...voxtral, voxtralLanguage: e.target.value })
                    }
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {TRANSCRIPTION_LANGUAGES.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testConnection("voxtral")}
                  disabled={testingHealth.voxtral}
                >
                  {testingHealth.voxtral ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Wifi className="h-4 w-4 mr-2" />
                  )}
                  Tester la connexion
                </Button>
              </div>
              <p className="text-xs text-muted-foreground italic">
                Pour activer : lancer le profil Docker
                <code className="bg-muted px-1 rounded mx-1">--profile voxtral</code>
                sur un serveur avec GPU NVIDIA.
                Le modèle (4B params, BF16, ~8 Go) se télécharge au premier démarrage.
              </p>
            </div>
          )}
        </div>

        {/* Ollama */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Ollama (LLM local)</p>
              <p className="text-xs text-muted-foreground">
                Modèles de langage locaux pour les résumés et le chat IA
              </p>
            </div>
            <div className="flex items-center gap-3">
              <HealthBadge result={healthResults.ollama} />
              <Toggle
                checked={ollama.ollamaEnabled}
                onChange={(v) => setOllama({ ...ollama, ollamaEnabled: v })}
              />
            </div>
          </div>

          {ollama.ollamaEnabled && (
            <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ollama-url">URL du service</Label>
                  <Input
                    id="ollama-url"
                    value={ollama.ollamaBaseUrl}
                    onChange={(e) =>
                      setOllama({ ...ollama, ollamaBaseUrl: e.target.value })
                    }
                    placeholder="http://localhost:11434"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ollama-model">Modèle par défaut</Label>
                  <Input
                    id="ollama-model"
                    value={ollama.ollamaDefaultModel}
                    onChange={(e) =>
                      setOllama({ ...ollama, ollamaDefaultModel: e.target.value })
                    }
                    placeholder="gemma4:e4b"
                  />
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => testConnection("ollama")}
                disabled={testingHealth.ollama}
              >
                {testingHealth.ollama ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Wifi className="h-4 w-4 mr-2" />
                )}
                Tester la connexion
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 3. Coûts et alertes */}
      <div className="rounded-lg border bg-card p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-amber-500" />
          <h3 className="text-lg font-semibold">Coûts et alertes</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="threshold-warning">Seuil d&apos;avertissement (%)</Label>
            <Input
              id="threshold-warning"
              type="number"
              min={0}
              max={100}
              value={alerts.thresholdWarning}
              onChange={(e) =>
                setAlerts({ ...alerts, thresholdWarning: parseInt(e.target.value) || 0 })
              }
            />
            <p className="text-xs text-muted-foreground">
              Notification quand le budget atteint ce pourcentage
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="threshold-critical">Seuil critique (%)</Label>
            <Input
              id="threshold-critical"
              type="number"
              min={0}
              max={200}
              value={alerts.thresholdCritical}
              onChange={(e) =>
                setAlerts({ ...alerts, thresholdCritical: parseInt(e.target.value) || 0 })
              }
            />
            <p className="text-xs text-muted-foreground">
              Alerte critique quand le budget est dépassé
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notification-email">Email de notification</Label>
            <Input
              id="notification-email"
              type="email"
              value={alerts.notificationEmail}
              onChange={(e) =>
                setAlerts({ ...alerts, notificationEmail: e.target.value })
              }
              placeholder="admin@example.com"
            />
            <p className="text-xs text-muted-foreground">
              Adresse qui recevra les alertes de dépassement
            </p>
          </div>
        </div>
      </div>

      {/* 4. Rétention des logs */}
      <div className="rounded-lg border bg-card p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-green-500" />
          <h3 className="text-lg font-semibold">Rétention des logs</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="retention-days">Durée de rétention (jours)</Label>
            <Input
              id="retention-days"
              type="number"
              min={1}
              max={365}
              value={retention.retentionDays}
              onChange={(e) =>
                setRetention({ ...retention, retentionDays: parseInt(e.target.value) || 90 })
              }
            />
            <p className="text-xs text-muted-foreground">
              Les logs plus anciens seront automatiquement supprimés
            </p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Stocker le contenu des requêtes</p>
              <p className="text-xs text-muted-foreground">
                Conserve le prompt et la réponse dans les logs (utile pour le débogage)
              </p>
            </div>
            <Toggle
              checked={retention.storeContent}
              onChange={(v) => setRetention({ ...retention, storeContent: v })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

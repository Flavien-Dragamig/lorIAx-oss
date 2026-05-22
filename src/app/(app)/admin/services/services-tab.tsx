"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Loader2,
  Wifi,
  Mic,
  Users,
  DoorOpen,
  Network,
  Brain,
  Mail,
  DatabaseBackup,
  Images,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ServiceCard, type HealthStatus } from "@/components/admin/service-card";

interface ServiceHealth {
  status: string;
  latency?: number;
  models?: string[];
  modelStatus?: string;
}

interface ModuleToggles {
  livekitEnabled: boolean;
  collabEnabled: boolean;
  meetingRoomsEnabled: boolean;
  ldapEnabled: boolean;
  aiEnabled: boolean;
  whisperConfigured: boolean;
  emailConfigured: boolean;
  backupConfigured: boolean;
  imagesConfigured: boolean;
}

const MODULES = [
  {
    key: "livekit",
    toggleKey: "livekitEnabled" as keyof ModuleToggles,
    settingsKey: "livekit" as string | null,
    settingsField: "livekitEnabled" as string | null,
    name: "Visioconférence",
    description: "Réunions vidéo LiveKit dans l'éditeur et la page réunions.",
    icon: <Wifi className="h-5 w-5" />,
    configHref: "/admin/visio",
    hasHealth: true,
    readOnly: false,
  },
  {
    key: "whisper",
    toggleKey: "whisperConfigured" as keyof ModuleToggles,
    settingsKey: null,
    settingsField: null,
    name: "Transcription audio",
    description: "Transcription automatique des réunions via Faster-Whisper.",
    icon: <Mic className="h-5 w-5" />,
    configHref: "/admin/ai",
    hasHealth: true,
    readOnly: true,
  },
  {
    key: "collab",
    toggleKey: "collabEnabled" as keyof ModuleToggles,
    settingsKey: "collab" as string | null,
    settingsField: "collabEnabled" as string | null,
    name: "Collaboration temps réel",
    description: "Édition simultanée de documents (Hocuspocus / Yjs).",
    icon: <Users className="h-5 w-5" />,
    configHref: "/admin/system",
    hasHealth: true,
    readOnly: false,
  },
  {
    key: "meetingRooms",
    toggleKey: "meetingRoomsEnabled" as keyof ModuleToggles,
    settingsKey: "meeting_rooms_enabled" as string | null,
    settingsField: null,
    name: "Salles de réunion",
    description: "Gestion des salles, réservations et permissions.",
    icon: <DoorOpen className="h-5 w-5" />,
    configHref: "/admin/meeting-rooms",
    hasHealth: false,
    readOnly: false,
  },
  {
    key: "ldap",
    toggleKey: "ldapEnabled" as keyof ModuleToggles,
    settingsKey: "ldap" as string | null,
    settingsField: "ldapEnabled" as string | null,
    name: "LDAP / Annuaire",
    description: "Authentification via Active Directory ou annuaire LDAP.",
    icon: <Network className="h-5 w-5" />,
    configHref: "/admin/system",
    hasHealth: true,
    readOnly: false,
  },
  {
    key: "ai",
    toggleKey: "aiEnabled" as keyof ModuleToggles,
    settingsKey: "ai_global" as string | null,
    settingsField: "enabled" as string | null,
    name: "Intelligence artificielle",
    description: "Providers IA, quotas, playground et logs.",
    icon: <Brain className="h-5 w-5" />,
    configHref: "/admin/ai",
    hasHealth: true,
    readOnly: false,
  },
  {
    key: "email",
    toggleKey: "emailConfigured" as keyof ModuleToggles,
    settingsKey: null,
    settingsField: null,
    name: "Messagerie email",
    description: "Envoi de notifications et invitations (SMTP ou Resend).",
    icon: <Mail className="h-5 w-5" />,
    configHref: "/admin/emails",
    hasHealth: false,
    readOnly: true,
  },
  {
    key: "backup",
    toggleKey: "backupConfigured" as keyof ModuleToggles,
    settingsKey: null,
    settingsField: null,
    name: "Sauvegardes",
    description: "Sauvegardes automatiques vers stockage S3 compatible.",
    icon: <DatabaseBackup className="h-5 w-5" />,
    configHref: "/admin/backups",
    hasHealth: false,
    readOnly: true,
  },
  {
    key: "images",
    toggleKey: "imagesConfigured" as keyof ModuleToggles,
    settingsKey: null,
    settingsField: null,
    name: "Banques d'images",
    description: "Bibliothèque org, Unsplash et autres banques d'images pour le Studio.",
    icon: <Images className="h-5 w-5" />,
    configHref: "/admin/images",
    hasHealth: false,
    readOnly: true,
  },
] as const;

const DEFAULT_TOGGLES: ModuleToggles = {
  livekitEnabled: false,
  collabEnabled: true,
  meetingRoomsEnabled: false,
  ldapEnabled: false,
  aiEnabled: false,
  whisperConfigured: false,
  emailConfigured: false,
  backupConfigured: false,
  imagesConfigured: false,
};

export function AdminServicesTab() {
  const [toggles, setToggles] = useState<ModuleToggles>(DEFAULT_TOGGLES);
  const [health, setHealth] = useState<Record<string, ServiceHealth>>({});
  const [loading, setLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const [settingsRes, providersRes] = await Promise.all([
        fetch("/api/admin/settings"),
        fetch("/api/admin/image-providers"),
      ]);
      const data = settingsRes.ok ? await settingsRes.json() : {};
      const providers = providersRes.ok ? await providersRes.json() : [];

      const unsplashEnabled = Array.isArray(providers)
        ? providers.some((p: { name: string; isEnabled: boolean; hasApiKey: boolean }) =>
            p.name === "unsplash" && p.isEnabled && p.hasApiKey
          )
        : false;

      setToggles({
        livekitEnabled: data.livekit?.livekitEnabled ?? false,
        collabEnabled: data.collab?.collabEnabled ?? true,
        meetingRoomsEnabled:
          typeof data.meeting_rooms_enabled === "boolean"
            ? data.meeting_rooms_enabled
            : (data.meeting_rooms_enabled?.enabled ?? false),
        ldapEnabled: data.ldap?.ldapEnabled ?? false,
        aiEnabled: data.ai_global?.enabled ?? false,
        whisperConfigured: !!(data.whisper?.whisperApiUrl),
        emailConfigured: !!(data.email?.smtpHost || data.email?.resendApiKey),
        backupConfigured: !!(data.backup_s3?.enabled),
        imagesConfigured: unsplashEnabled,
      });
    } catch {
      // conserver les valeurs par défaut
    } finally {
      setLoading(false);
    }
  }, []);

  const checkHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const res = await fetch("/api/admin/services/health");
      if (res.ok) setHealth(await res.json());
    } catch {
      // ignorer
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [loadSettings, checkHealth]);

  async function handleToggle(module: (typeof MODULES)[number]) {
    if (module.readOnly) return;
    setToggling(module.key);

    const newValue = !toggles[module.toggleKey];
    setToggles((prev) => ({ ...prev, [module.toggleKey]: newValue }));

    try {
      let body: Record<string, unknown>;
      if (module.settingsField && module.settingsKey) {
        body = { [module.settingsKey]: { [module.settingsField]: newValue } };
      } else if (module.settingsKey === "meeting_rooms_enabled") {
        body = { meeting_rooms_enabled: newValue };
      } else {
        return;
      }

      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        setToggles((prev) => ({ ...prev, [module.toggleKey]: !newValue }));
      } else {
        await checkHealth();
      }
    } catch {
      setToggles((prev) => ({ ...prev, [module.toggleKey]: !newValue }));
    } finally {
      setToggling(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Services & modules</h2>
          <p className="text-sm text-muted-foreground mt-1">
            État et activation des fonctionnalités de l&apos;application.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={checkHealth} disabled={healthLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${healthLoading ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {MODULES.map((module) => {
          const h = health[module.key];
          return (
            <ServiceCard
              key={module.key}
              icon={module.icon}
              name={module.name}
              description={module.description}
              enabled={toggles[module.toggleKey]}
              healthStatus={h?.status as HealthStatus | undefined}
              latency={h?.latency}
              configHref={module.configHref}
              onToggle={module.readOnly ? undefined : () => handleToggle(module)}
              toggling={toggling === module.key}
            />
          );
        })}
      </div>
    </div>
  );
}

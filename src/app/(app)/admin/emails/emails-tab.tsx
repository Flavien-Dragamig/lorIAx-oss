"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Mail,
  Send,
  FileText,
  History,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Server,
  Cloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── Types ──────────────────────────────────────────────────────────────────

type EmailProvider = "smtp" | "resend";

interface EmailSettings {
  emailEnabled: boolean;
  emailProvider: EmailProvider;
  // SMTP
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPassword: string;
  smtpFrom: string;
  smtpSecure: boolean;
  // Resend
  resendApiKey: string;
  resendFrom: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  subject: string;
  variables: string[];
}

interface EmailLogEntry {
  id: string;
  to: string;
  subject: string;
  template: string;
  status: "sent" | "failed";
  error?: string;
  sentAt: string;
}

const defaultSettings: EmailSettings = {
  emailEnabled: false,
  emailProvider: "smtp",
  smtpHost: "",
  smtpPort: "587",
  smtpUser: "",
  smtpPassword: "",
  smtpFrom: "",
  smtpSecure: false,
  resendApiKey: "",
  resendFrom: "",
};

// Templates statiques correspondant aux fichiers dans lib/email/templates/
const emailTemplates: EmailTemplate[] = [
  {
    id: "password-reset",
    name: "Réinitialisation de mot de passe",
    description: "Envoyé lorsqu'un utilisateur demande un nouveau mot de passe.",
    subject: "LorIAx — Réinitialisation de mot de passe",
    variables: ["userName", "resetUrl", "expiresInMinutes"],
  },
  {
    id: "invitation",
    name: "Invitation à un espace",
    description: "Envoyé lorsqu'un membre est invité à rejoindre un espace.",
    subject: "LorIAx — Invitation dans un espace",
    variables: ["inviterName", "spaceName", "acceptUrl"],
  },
  {
    id: "notification",
    name: "Notification d'activité",
    description: "Envoyé pour les mentions, commentaires, réponses et partages.",
    subject: "LorIAx — Nouvelle notification",
    variables: ["userName", "actorName", "type", "documentTitle", "documentUrl", "message"],
  },
];

// ─── Composant principal ────────────────────────────────────────────────────

export function AdminEmailsTab() {
  const [activeSection, setActiveSection] = useState<"config" | "templates" | "history">("config");
  const [settings, setSettings] = useState<EmailSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [logs, setLogs] = useState<EmailLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const sections = [
    { id: "config" as const, label: "Configuration", icon: Mail },
    { id: "templates" as const, label: "Courriels types", icon: FileText },
    { id: "history" as const, label: "Historique", icon: History },
  ];

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (!res.ok) return;
      const data = await res.json();

      // Support new "email" key or legacy "smtp" key
      if (data.email) {
        setSettings((prev) => ({ ...prev, ...data.email }));
      } else if (data.smtp) {
        // Map legacy smtp settings
        const smtp = data.smtp;
        setSettings((prev) => ({
          ...prev,
          emailEnabled: smtp.smtpEnabled ?? false,
          emailProvider: "smtp",
          smtpHost: smtp.smtpHost ?? "",
          smtpPort: String(smtp.smtpPort ?? "587"),
          smtpUser: smtp.smtpUser ?? "",
          smtpPassword: smtp.smtpPassword ?? "",
          smtpFrom: smtp.smtpFrom ?? "",
          smtpSecure: smtp.smtpSecure ?? false,
        }));
      }
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function loadLogs() {
    setLogsLoading(true);
    try {
      const res = await fetch("/api/admin/emails/logs");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setLogs(data);
      }
    } catch {
      // Silently fail — logs are informational
    } finally {
      setLogsLoading(false);
    }
  }

  useEffect(() => {
    if (activeSection === "history") {
      loadLogs();
    }
  }, [activeSection]);

  function update<K extends keyof EmailSettings>(key: K, value: EmailSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: {
            emailEnabled: settings.emailEnabled,
            emailProvider: settings.emailProvider,
            smtpHost: settings.smtpHost,
            smtpPort: settings.smtpPort,
            smtpUser: settings.smtpUser,
            smtpPassword: settings.smtpPassword,
            smtpFrom: settings.smtpFrom,
            smtpSecure: settings.smtpSecure,
            resendApiKey: settings.resendApiKey,
            resendFrom: settings.resendFrom,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la sauvegarde");
      }
      toast.success("Configuration email sauvegardée");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      await handleSave();

      const endpoint =
        settings.emailProvider === "resend"
          ? "/api/admin/settings/resend-test"
          : "/api/admin/settings/smtp-test";

      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
      } else {
        toast.error(data.error);
      }
    } catch {
      toast.error("Erreur lors du test");
    } finally {
      setTesting(false);
    }
  }

  const canTest =
    settings.emailProvider === "resend"
      ? !!settings.resendApiKey
      : !!settings.smtpHost;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Gestion des mails</h2>
        <p className="text-sm text-muted-foreground">
          Configuration du provider d&apos;envoi, templates de courriels et historique.
        </p>
      </div>

      {/* Sous-navigation */}
      <div className="flex gap-1 border-b border-border pb-px">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeSection === section.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {section.label}
            </button>
          );
        })}
      </div>

      {/* Configuration */}
      {activeSection === "config" && (
        <div className="space-y-6">
          {/* Toggle global */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Activer l&apos;envoi d&apos;emails</p>
              <p className="text-xs text-muted-foreground">
                Notifications, invitations et réinitialisation de mot de passe
              </p>
            </div>
            <button
              onClick={() => update("emailEnabled", !settings.emailEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.emailEnabled ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.emailEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {settings.emailEnabled && (
            <div className="space-y-6">
              {/* Choix du provider */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Provider d&apos;envoi</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => update("emailProvider", "smtp")}
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-colors text-left ${
                      settings.emailProvider === "smtp"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <div className={`p-2 rounded-md ${
                      settings.emailProvider === "smtp" ? "bg-primary/10" : "bg-muted"
                    }`}>
                      <Server className={`h-5 w-5 ${
                        settings.emailProvider === "smtp" ? "text-primary" : "text-muted-foreground"
                      }`} />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Serveur SMTP</p>
                      <p className="text-xs text-muted-foreground">
                        Serveur mail auto-hébergé ou tiers
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => update("emailProvider", "resend")}
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-colors text-left ${
                      settings.emailProvider === "resend"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <div className={`p-2 rounded-md ${
                      settings.emailProvider === "resend" ? "bg-primary/10" : "bg-muted"
                    }`}>
                      <Cloud className={`h-5 w-5 ${
                        settings.emailProvider === "resend" ? "text-primary" : "text-muted-foreground"
                      }`} />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Resend</p>
                      <p className="text-xs text-muted-foreground">
                        API cloud pour l&apos;envoi d&apos;emails
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Configuration SMTP */}
              {settings.emailProvider === "smtp" && (
                <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="smtp-host">Serveur SMTP</Label>
                      <Input
                        id="smtp-host"
                        value={settings.smtpHost}
                        onChange={(e) => update("smtpHost", e.target.value)}
                        placeholder="smtp.example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtp-port">Port</Label>
                      <Input
                        id="smtp-port"
                        value={settings.smtpPort}
                        onChange={(e) => update("smtpPort", e.target.value)}
                        placeholder="587"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtp-user">Identifiant</Label>
                      <Input
                        id="smtp-user"
                        value={settings.smtpUser}
                        onChange={(e) => update("smtpUser", e.target.value)}
                        placeholder="noreply@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtp-password">Mot de passe</Label>
                      <Input
                        id="smtp-password"
                        type="password"
                        value={settings.smtpPassword}
                        onChange={(e) => update("smtpPassword", e.target.value)}
                        placeholder="••••••••"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtp-from">Expéditeur</Label>
                      <Input
                        id="smtp-from"
                        value={settings.smtpFrom}
                        onChange={(e) => update("smtpFrom", e.target.value)}
                        placeholder="LorIAx <noreply@example.com>"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Connexion sécurisée (TLS)</Label>
                      <button
                        onClick={() => update("smtpSecure", !settings.smtpSecure)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          settings.smtpSecure ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            settings.smtpSecure ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Configuration Resend */}
              {settings.emailProvider === "resend" && (
                <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="resend-api-key">Clé API Resend</Label>
                      <Input
                        id="resend-api-key"
                        type="password"
                        value={settings.resendApiKey}
                        onChange={(e) => update("resendApiKey", e.target.value)}
                        placeholder="re_xxxxxxxxxxxx"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="resend-from">Expéditeur</Label>
                      <Input
                        id="resend-from"
                        value={settings.resendFrom}
                        onChange={(e) => update("resendFrom", e.target.value)}
                        placeholder="LorIAx <noreply@votre-domaine.com>"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Obtenez votre clé API sur{" "}
                    <a
                      href="https://resend.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-foreground"
                    >
                      resend.com/api-keys
                    </a>
                    . Le domaine expéditeur doit être vérifié dans votre compte Resend.
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={testing || !canTest}
                  onClick={handleTest}
                >
                  {testing ? (
                    <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5 mr-2" />
                  )}
                  Tester la connexion
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  ) : (
                    <Mail className="h-3.5 w-3.5 mr-2" />
                  )}
                  Enregistrer
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Courriels types */}
      {activeSection === "templates" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Templates de courriels utilisés par le système. Ces modèles sont définis dans le code source.
          </p>
          <div className="grid gap-4">
            {emailTemplates.map((tpl) => (
              <div
                key={tpl.id}
                className="p-4 rounded-lg border border-border bg-card hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 p-2 rounded-md bg-primary/10">
                      <Mail className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">{tpl.name}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{tpl.description}</p>
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">Objet :</span> {tpl.subject}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {tpl.variables.map((v) => (
                          <span
                            key={v}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground font-mono"
                          >
                            {`{{${v}}}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" disabled title="Aperçu (bientôt)">
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historique */}
      {activeSection === "history" && (
        <div className="space-y-4">
          {logsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <History className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Aucun email envoyé pour le moment.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                L&apos;historique apparaîtra ici une fois le provider configuré et des emails envoyés.
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Statut</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Destinataire</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Objet</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Template</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        {log.status === "sent" ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">{log.to}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{log.subject}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                          {log.template}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(log.sentAt).toLocaleString("fr-FR")}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

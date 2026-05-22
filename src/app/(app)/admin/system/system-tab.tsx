"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Settings,
  Globe,
  Shield,
  Server,
  Users,
  Loader2,
  Network,
  MousePointerClick,
  TriangleAlert,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SystemSettings {
  appName: string;
  appUrl: string;
  allowRegistration: boolean;
  defaultRole: string;
}

interface LdapSettings {
  ldapEnabled: boolean;
  ldapUrl: string;
  ldapBindDn: string;
  ldapBindPassword: string;
  ldapBaseDn: string;
  ldapSearchFilter: string;
  ldapNameAttribute: string;
  ldapEmailAttribute: string;
  ldapRejectUnauthorized: boolean;
}

interface CollabSettings {
  collabEnabled: boolean;
}

interface RolePermissions {
  canCreateSpaces: boolean;
  canCreatePublicDocs: boolean;
  canCreateTemplates: boolean;
  canInviteMembers: boolean;
}

const defaultSettings: SystemSettings = {
  appName: "LorIAx",
  appUrl: "",
  allowRegistration: true,
  defaultRole: "editor",
};

const defaultCollabSettings: CollabSettings = {
  collabEnabled: true,
};

const defaultLdapSettings: LdapSettings = {
  ldapEnabled: false,
  ldapUrl: "",
  ldapBindDn: "",
  ldapBindPassword: "",
  ldapBaseDn: "",
  ldapSearchFilter: "(mail={{email}})",
  ldapNameAttribute: "cn",
  ldapEmailAttribute: "mail",
  ldapRejectUnauthorized: true,
};

const defaultRolePermissions: Record<string, RolePermissions> = {
  viewer: {
    canCreateSpaces: false,
    canCreatePublicDocs: false,
    canCreateTemplates: false,
    canInviteMembers: false,
  },
  editor: {
    canCreateSpaces: true,
    canCreatePublicDocs: true,
    canCreateTemplates: false,
    canInviteMembers: true,
  },
  admin: {
    canCreateSpaces: true,
    canCreatePublicDocs: true,
    canCreateTemplates: true,
    canInviteMembers: true,
  },
};

const permissionLabels: Record<keyof RolePermissions, { label: string; description: string }> = {
  canCreateSpaces: {
    label: "Créer des espaces",
    description: "Peut créer de nouveaux espaces de travail",
  },
  canCreatePublicDocs: {
    label: "Publier des documents",
    description: "Peut rendre des documents publics à toute l'organisation",
  },
  canCreateTemplates: {
    label: "Gérer les templates",
    description: "Peut créer et modifier des templates globaux",
  },
  canInviteMembers: {
    label: "Inviter des membres",
    description: "Peut ajouter des collaborateurs à ses espaces",
  },
};

export function AdminSystemTab() {
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [collabSettings, setCollabSettings] = useState<CollabSettings>(defaultCollabSettings);
  const [ldapSettings, setLdapSettings] = useState<LdapSettings>(defaultLdapSettings);
  const [rolePerms, setRolePerms] = useState(defaultRolePermissions);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingLdap, setTestingLdap] = useState(false);
  const [appVersion, setAppVersion] = useState<string>("...");
  const [showWizardModal, setShowWizardModal] = useState(false);
  const [wizardPassword, setWizardPassword] = useState("");
  const [wizardPasswordVisible, setWizardPasswordVisible] = useState(false);
  const [wizardVerifying, setWizardVerifying] = useState(false);
  const [wizardError, setWizardError] = useState("");

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data) => setAppVersion(data.version || "dev"))
      .catch(() => {});
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (!res.ok) return;
      const data = await res.json();

      if (data.general) {
        setSettings((prev) => ({ ...prev, ...data.general }));
      }
      if (data.auth) {
        setSettings((prev) => ({
          ...prev,
          allowRegistration: data.auth.allowRegistration ?? prev.allowRegistration,
          defaultRole: data.auth.defaultRole ?? prev.defaultRole,
        }));
      }
      if (data.collab) {
        setCollabSettings((prev) => ({ ...prev, ...data.collab }));
      }
      if (data.ldap) {
        setLdapSettings((prev) => ({ ...prev, ...data.ldap }));
      }
      if (data.rolePermissions) {
        setRolePerms((prev) => ({
          ...prev,
          ...data.rolePermissions,
        }));
      }
    } catch {
      // Use defaults on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && !settings.appUrl) {
      setSettings((prev) => ({ ...prev, appUrl: window.location.origin }));
    }
    loadSettings();
  }, [loadSettings, settings.appUrl]);

  function updateSetting<K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function updateLdap<K extends keyof LdapSettings>(key: K, value: LdapSettings[K]) {
    setLdapSettings((prev) => ({ ...prev, [key]: value }));
  }

  function toggleRolePerm(role: string, perm: keyof RolePermissions) {
    setRolePerms((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [perm]: !prev[role][perm],
      },
    }));
  }

  async function handleWizardConfirm() {
    setWizardError("");
    setWizardVerifying(true);
    try {
      const res = await fetch("/api/admin/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: wizardPassword }),
      });
      if (!res.ok) {
        const data = await res.json();
        setWizardError(data.error || "Mot de passe incorrect");
        return;
      }
      window.location.href = "/setup";
    } catch {
      setWizardError("Erreur réseau, veuillez réessayer");
    } finally {
      setWizardVerifying(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        general: {
          appName: settings.appName,
          appUrl: settings.appUrl,
        },
        auth: {
          allowRegistration: settings.allowRegistration,
          defaultRole: settings.defaultRole,
        },
        collab: collabSettings,
        ldap: ldapSettings,
        rolePermissions: rolePerms,
      };

      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la sauvegarde");
      }

      toast.success("Paramètres sauvegardés");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
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
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Paramètres système</h2>
        <p className="text-sm text-muted-foreground">
          Configuration générale de l&apos;application.
        </p>
      </div>

      {/* Général */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium">Général</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="app-name">Nom de l&apos;application</Label>
            <Input
              id="app-name"
              value={settings.appName}
              onChange={(e) => updateSetting("appName", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="app-url">URL de l&apos;application</Label>
            <Input
              id="app-url"
              value={settings.appUrl}
              onChange={(e) => updateSetting("appUrl", e.target.value)}
              placeholder="https://loriax.example.com"
            />
          </div>
        </div>
      </section>

      {/* Authentification */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium">Authentification</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Inscription ouverte</p>
              <p className="text-xs text-muted-foreground">
                Permettre aux nouveaux utilisateurs de créer un compte
              </p>
            </div>
            <button
              onClick={() => updateSetting("allowRegistration", !settings.allowRegistration)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.allowRegistration ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.allowRegistration ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="default-role">Rôle par défaut des nouveaux utilisateurs</Label>
            <select
              id="default-role"
              value={settings.defaultRole}
              onChange={(e) => updateSetting("defaultRole", e.target.value)}
              className="px-3 py-2 rounded-md border border-input bg-background text-sm"
            >
              <option value="viewer">Lecteur</option>
              <option value="editor">Éditeur</option>
              <option value="admin">Administrateur</option>
            </select>
          </div>
        </div>
      </section>

      {/* Collaboration temps réel */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium">Collaboration temps réel</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Activer la collaboration</p>
              <p className="text-xs text-muted-foreground">
                Permet l&apos;édition simultanée de documents par plusieurs utilisateurs (WebSocket).
                Désactiver en cas de problèmes de performance ou de rendu.
              </p>
            </div>
            <button
              onClick={() => setCollabSettings((prev) => ({ ...prev, collabEnabled: !prev.collabEnabled }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                collabSettings.collabEnabled ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  collabSettings.collabEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {!collabSettings.collabEnabled && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                La collaboration est désactivée. Les documents seront verrouillés individuellement
                lorsqu&apos;un utilisateur les modifie (mode verrou pessimiste). Les curseurs
                temps réel et la co-édition ne seront pas disponibles.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* LDAP / Annuaire */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <Network className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium">LDAP / Annuaire</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Activer l&apos;authentification LDAP</p>
              <p className="text-xs text-muted-foreground">
                Permet aux utilisateurs de se connecter via un annuaire LDAP / Active Directory
              </p>
            </div>
            <button
              onClick={() => updateLdap("ldapEnabled", !ldapSettings.ldapEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                ldapSettings.ldapEnabled ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  ldapSettings.ldapEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {ldapSettings.ldapEnabled && (
            <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="ldap-url">URL du serveur LDAP</Label>
                  <Input
                    id="ldap-url"
                    value={ldapSettings.ldapUrl}
                    onChange={(e) => updateLdap("ldapUrl", e.target.value)}
                    placeholder="ldaps://ldap.example.com:636"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ldap-bind-dn">Bind DN (compte de service)</Label>
                  <Input
                    id="ldap-bind-dn"
                    value={ldapSettings.ldapBindDn}
                    onChange={(e) => updateLdap("ldapBindDn", e.target.value)}
                    placeholder="cn=admin,dc=example,dc=com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ldap-bind-password">Mot de passe Bind</Label>
                  <Input
                    id="ldap-bind-password"
                    type="password"
                    value={ldapSettings.ldapBindPassword}
                    onChange={(e) => updateLdap("ldapBindPassword", e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ldap-base-dn">Base DN</Label>
                  <Input
                    id="ldap-base-dn"
                    value={ldapSettings.ldapBaseDn}
                    onChange={(e) => updateLdap("ldapBaseDn", e.target.value)}
                    placeholder="dc=example,dc=com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ldap-filter">Filtre de recherche</Label>
                  <Input
                    id="ldap-filter"
                    value={ldapSettings.ldapSearchFilter}
                    onChange={(e) => updateLdap("ldapSearchFilter", e.target.value)}
                    placeholder="(mail={{email}})"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ldap-name-attr">Attribut nom</Label>
                  <Input
                    id="ldap-name-attr"
                    value={ldapSettings.ldapNameAttribute}
                    onChange={(e) => updateLdap("ldapNameAttribute", e.target.value)}
                    placeholder="cn"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ldap-email-attr">Attribut email</Label>
                  <Input
                    id="ldap-email-attr"
                    value={ldapSettings.ldapEmailAttribute}
                    onChange={(e) => updateLdap("ldapEmailAttribute", e.target.value)}
                    placeholder="mail"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateLdap("ldapRejectUnauthorized", !ldapSettings.ldapRejectUnauthorized)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      ldapSettings.ldapRejectUnauthorized ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        ldapSettings.ldapRejectUnauthorized ? "translate-x-4.5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                  <span className="text-sm text-muted-foreground">Vérifier le certificat TLS</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={testingLdap || !ldapSettings.ldapUrl}
                  onClick={async () => {
                    setTestingLdap(true);
                    try {
                      await handleSave();
                      const res = await fetch("/api/admin/settings/ldap-test", {
                        method: "POST",
                      });
                      const data = await res.json();
                      if (res.ok) {
                        toast.success(data.message);
                      } else {
                        toast.error(data.error);
                      }
                    } catch {
                      toast.error("Erreur lors du test LDAP");
                    } finally {
                      setTestingLdap(false);
                    }
                  }}
                >
                  {testingLdap ? (
                    <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  ) : (
                    <Network className="h-3.5 w-3.5 mr-2" />
                  )}
                  Tester la connexion
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Permissions par rôle */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium">Permissions par rôle</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Permission</th>
                {(["viewer", "editor", "admin"] as const).map((role) => (
                  <th key={role} className="text-center py-2 px-4 font-medium text-muted-foreground">
                    {{
                      viewer: "Lecteur",
                      editor: "Éditeur",
                      admin: "Admin",
                    }[role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(Object.keys(permissionLabels) as Array<keyof RolePermissions>).map((perm) => (
                <tr key={perm} className="border-b border-border last:border-0">
                  <td className="py-3 pr-4">
                    <p className="font-medium">{permissionLabels[perm].label}</p>
                    <p className="text-xs text-muted-foreground">
                      {permissionLabels[perm].description}
                    </p>
                  </td>
                  {(["viewer", "editor", "admin"] as const).map((role) => (
                    <td key={role} className="text-center py-3 px-4">
                      <button
                        onClick={() => toggleRolePerm(role, perm)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          rolePerms[role][perm] ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            rolePerms[role][perm] ? "translate-x-4.5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Les permissions IA (chat, playground, logs) sont gérées dans la{" "}
          <a href="/admin/ai/settings" className="text-primary hover:underline">section Intelligence artificielle</a>.
        </p>
      </section>

      {/* Zone dangereuse */}
      <div className="flex items-center gap-2 pt-2">
        <TriangleAlert className="h-4 w-4 text-destructive" />
        <span className="text-sm font-semibold text-destructive uppercase tracking-wide">Zone dangereuse</span>
      </div>

      {/* Configuration initiale */}
      <section className="space-y-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
        <div className="flex items-center gap-2 border-b border-destructive/20 pb-2">
          <MousePointerClick className="h-4 w-4 text-destructive/70" />
          <h3 className="font-medium text-destructive/90">Configuration initiale</h3>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Assistant de configuration</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Relancer le wizard pour reconfigurer l&apos;identité, les utilisateurs et les espaces.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              setWizardPassword("");
              setWizardError("");
              setShowWizardModal(true);
            }}
          >
            <MousePointerClick className="h-4 w-4 mr-2" />
            Relancer le wizard
          </Button>
        </div>
      </section>

      {/* Modale confirmation mot de passe */}
      {showWizardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <TriangleAlert className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h2 className="font-semibold text-base">Confirmer votre identité</h2>
                <p className="text-xs text-muted-foreground">Saisissez votre mot de passe administrateur pour continuer.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wizard-password">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="wizard-password"
                  type={wizardPasswordVisible ? "text" : "password"}
                  value={wizardPassword}
                  onChange={(e) => { setWizardPassword(e.target.value); setWizardError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleWizardConfirm()}
                  placeholder="••••••••"
                  autoFocus
                  className={wizardError ? "border-destructive pr-10" : "pr-10"}
                />
                <button
                  type="button"
                  onClick={() => setWizardPasswordVisible((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {wizardPasswordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {wizardError && (
                <p className="text-xs text-destructive">{wizardError}</p>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowWizardModal(false)}
                disabled={wizardVerifying}
              >
                Annuler
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleWizardConfirm}
                disabled={!wizardPassword || wizardVerifying}
              >
                {wizardVerifying ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <MousePointerClick className="h-4 w-4 mr-2" />
                )}
                Accéder au wizard
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Informations système */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <Server className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium">Informations système</h3>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 rounded-lg border border-border">
            <p className="text-xs text-muted-foreground">Version</p>
            <p className="text-sm font-medium">{appVersion}</p>
          </div>
          <div className="p-3 rounded-lg border border-border">
            <p className="text-xs text-muted-foreground">Framework</p>
            <p className="text-sm font-medium">Next.js 16</p>
          </div>
          <div className="p-3 rounded-lg border border-border">
            <p className="text-xs text-muted-foreground">Base de données</p>
            <p className="text-sm font-medium">PostgreSQL 16</p>
          </div>
        </div>
      </section>

      <div className="flex justify-end pt-4 border-t border-border">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Settings className="h-4 w-4 mr-2" />
          )}
          Enregistrer les paramètres
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  DatabaseBackup,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  HardDrive,
  Cloud,
  RefreshCw,
  Wifi,
  Download,
  History,
  ChevronLeft,
  ChevronRight,
  CalendarClock,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BackupJob {
  id: string;
  type: "client" | "technical" | "full";
  status: "running" | "completed" | "failed";
  triggeredBy: string | null;
  startedAt: string;
  completedAt: string | null;
  sizeBytes: number | null;
  s3Key: string | null;
  error: string | null;
  tableCount: number | null;
}

interface BackupStatus {
  running: BackupJob[];
  lastCompleted: Record<string, BackupJob | null>;
  s3Configured: boolean;
}

interface S3Config {
  s3BackupEndpoint: string;
  s3BackupPort: string;
  s3BackupRegion: string;
  s3BackupBucket: string;
  s3BackupAccessKey: string;
  s3BackupSecretKey: string;
  s3BackupUseSsl: boolean;
}

const BACKUP_TYPES = [
  { key: "client" as const, label: "Client", description: "Données utilisateur (documents, espaces, équipes, calendriers)", icon: HardDrive, color: "text-blue-500" },
  { key: "technical" as const, label: "Technique", description: "Configuration système (fournisseurs IA, paramètres, permissions)", icon: DatabaseBackup, color: "text-amber-500" },
  { key: "full" as const, label: "Complète", description: "Sauvegarde intégrale de toutes les tables", icon: Cloud, color: "text-green-500" },
];

function formatSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} Go`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Jamais";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}min ${Math.round((ms % 60000) / 1000)}s`;
}

export function AdminBackupsTab() {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);

  // S3 config
  const [s3Config, setS3Config] = useState<S3Config>({
    s3BackupEndpoint: "",
    s3BackupPort: "",
    s3BackupRegion: "us-east-1",
    s3BackupBucket: "",
    s3BackupAccessKey: "",
    s3BackupSecretKey: "",
    s3BackupUseSsl: true,
  });
  const [schedule, setSchedule] = useState({
    clientCron: "0 2 * * *",
    technicalCron: "0 3 * * *",
    enabled: false,
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"success" | "error" | null>(null);

  // History
  const [history, setHistory] = useState<BackupJob[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyTotalPages, setHistoryTotalPages] = useState(0);
  const [historyFilter, setHistoryFilter] = useState<string>("");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [restoreJobId, setRestoreJobId] = useState<string | null>(null);
  const [restorePassword, setRestorePassword] = useState("");
  const [restoring, setRestoring] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/backups/status");
      if (res.ok) {
        setStatus(await res.json());
      }
    } catch (err) {
      console.error("Failed to load backup status:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/backups/config");
      if (res.ok) {
        const data = await res.json();
        if (data.s3) {
          setS3Config((prev) => ({ ...prev, ...data.s3, s3BackupSecretKey: "" }));
        }
        if (data.schedule) {
          setSchedule((prev) => ({ ...prev, ...data.schedule }));
        }
      }
    } catch (err) {
      console.error("Failed to load backup config:", err);
    }
  }, []);

  const loadHistory = useCallback(async (page = 1, filter = "") => {
    setLoadingHistory(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (filter) params.set("type", filter);
      const res = await fetch(`/api/admin/backups/history?${params}`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data.jobs);
        setHistoryPage(data.pagination.page);
        setHistoryTotal(data.pagination.total);
        setHistoryTotalPages(data.pagination.totalPages);
      }
    } catch (err) {
      console.error("Failed to load backup history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const handleDownload = async (jobId: string) => {
    setDownloading(jobId);
    try {
      const res = await fetch(`/api/admin/backups/download?jobId=${jobId}`);
      if (res.ok) {
        const { url } = await res.json();
        window.open(url, "_blank");
      } else {
        const data = await res.json();
        throw new Error(data.error || "Erreur");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors du téléchargement");
    } finally {
      setDownloading(null);
    }
  };

  const handleRestore = async () => {
    if (!restoreJobId || !restorePassword) return;
    setRestoring(true);
    try {
      const res = await fetch("/api/admin/backups/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: restoreJobId, confirmPassword: restorePassword }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Restauration effectuée avec succès");
        if (data.warnings) {
          toast.warning("Avertissements pg_restore : " + data.warnings);
        }
        setRestoreJobId(null);
        setRestorePassword("");
      } else {
        throw new Error(data.error || "Erreur lors de la restauration");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la restauration");
    } finally {
      setRestoring(false);
    }
  };

  useEffect(() => {
    loadStatus();
    loadConfig();
    loadHistory();
  }, [loadStatus, loadConfig, loadHistory]);

  // Poll when jobs are running
  useEffect(() => {
    if (!status?.running.length) return;
    const interval = setInterval(loadStatus, 5000);
    return () => clearInterval(interval);
  }, [status?.running.length, loadStatus]);

  const handleTrigger = async (type: "client" | "technical" | "full") => {
    setTriggering(type);
    try {
      const res = await fetch("/api/admin/backups/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });

      if (res.ok) {
        toast.success("Sauvegarde lancée");
        await loadStatus();
      } else {
        const data = await res.json();
        throw new Error(data.error || "Erreur");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors du lancement");
    } finally {
      setTriggering(null);
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const res = await fetch("/api/admin/backups/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ s3: s3Config, schedule }),
      });

      if (res.ok) {
        toast.success("Configuration enregistrée");
        setConnectionStatus(null);
        await loadStatus();
      } else {
        const data = await res.json();
        throw new Error(data.error || "Erreur");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la sauvegarde");
    } finally {
      setSavingConfig(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    try {
      const res = await fetch("/api/admin/backups/config/test", { method: "POST" });
      const data = await res.json();

      if (data.success) {
        setConnectionStatus("success");
        toast.success("Connexion S3 réussie");
      } else {
        setConnectionStatus("error");
        toast.error(data.error || "Connexion échouée");
      }
    } catch {
      setConnectionStatus("error");
      toast.error("Erreur lors du test");
    } finally {
      setTestingConnection(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Sauvegardes</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Sauvegarde des bases de données vers un stockage S3 distant.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadStatus}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* S3 not configured warning */}
      {!status?.s3Configured && (
        <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm">
          La destination S3 n&apos;est pas configurée. Veuillez renseigner les paramètres ci-dessous avant de lancer une sauvegarde.
        </div>
      )}

      {/* ======= Section 1: Backup Status Cards ======= */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <DatabaseBackup className="h-4 w-4 text-primary" />
          <h3 className="font-medium">État des sauvegardes</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {BACKUP_TYPES.map(({ key, label, description, icon: Icon, color }) => {
            const last = status?.lastCompleted[key];
            const isRunning = status?.running.some((j) => j.type === key);
            const isTriggering = triggering === key;

            return (
              <div
                key={key}
                className="p-4 rounded-lg border border-border bg-card space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${color}`} />
                    <h4 className="font-medium">{label}</h4>
                  </div>
                  {isRunning ? (
                    <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      En cours
                    </span>
                  ) : last ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : null}
                </div>

                <p className="text-xs text-muted-foreground">{description}</p>

                {last && (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(last.completedAt)}
                    </div>
                    <div className="flex items-center gap-1">
                      <HardDrive className="h-3 w-3" />
                      {formatSize(last.sizeBytes)}
                      {last.tableCount ? ` · ${last.tableCount} tables` : ""}
                    </div>
                    {last.startedAt && last.completedAt && (
                      <div>Durée : {formatDuration(last.startedAt, last.completedAt)}</div>
                    )}
                  </div>
                )}

                {!last && !isRunning && (
                  <p className="text-xs text-muted-foreground italic">Aucune sauvegarde</p>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  disabled={isRunning || isTriggering || !status?.s3Configured}
                  onClick={() => handleTrigger(key)}
                >
                  {isTriggering ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Lancer maintenant
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ======= Section 2: S3 Destination ======= */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <Cloud className="h-4 w-4 text-blue-500" />
          <h3 className="font-medium">Destination S3</h3>
          {connectionStatus === "success" && (
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" title="Connecté" />
          )}
          {connectionStatus === "error" && (
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" title="Erreur" />
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          Compatible S3 : Backblaze B2, AWS S3, Scaleway, OVH, MinIO…
        </p>

        <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="s3-endpoint">Point d&apos;accès (endpoint)</Label>
              <Input
                id="s3-endpoint"
                value={s3Config.s3BackupEndpoint}
                onChange={(e) => setS3Config({ ...s3Config, s3BackupEndpoint: e.target.value })}
                placeholder="s3.us-east-005.backblazeb2.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s3-port">Port (optionnel)</Label>
              <Input
                id="s3-port"
                value={s3Config.s3BackupPort}
                onChange={(e) => setS3Config({ ...s3Config, s3BackupPort: e.target.value })}
                placeholder="443"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s3-region">Région</Label>
              <Input
                id="s3-region"
                value={s3Config.s3BackupRegion}
                onChange={(e) => setS3Config({ ...s3Config, s3BackupRegion: e.target.value })}
                placeholder="us-east-1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s3-bucket">Bucket</Label>
              <Input
                id="s3-bucket"
                value={s3Config.s3BackupBucket}
                onChange={(e) => setS3Config({ ...s3Config, s3BackupBucket: e.target.value })}
                placeholder="loriax-backups"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s3-access-key">Clé d&apos;accès</Label>
              <Input
                id="s3-access-key"
                value={s3Config.s3BackupAccessKey}
                onChange={(e) => setS3Config({ ...s3Config, s3BackupAccessKey: e.target.value })}
                placeholder="AKIAIOSFODNN7EXAMPLE"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s3-secret-key">Clé secrète</Label>
              <Input
                id="s3-secret-key"
                type="password"
                value={s3Config.s3BackupSecretKey}
                onChange={(e) => setS3Config({ ...s3Config, s3BackupSecretKey: e.target.value })}
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setS3Config({ ...s3Config, s3BackupUseSsl: !s3Config.s3BackupUseSsl })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  s3Config.s3BackupUseSsl ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    s3Config.s3BackupUseSsl ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <span className="text-sm">Utiliser SSL (HTTPS)</span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testingConnection || !s3Config.s3BackupEndpoint || !s3Config.s3BackupBucket}
            >
              {testingConnection ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Wifi className="h-4 w-4 mr-2" />
              )}
              Tester la connexion
            </Button>
          </div>
        </div>
      </section>

      {/* ======= Section 2b: Schedule ======= */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <CalendarClock className="h-4 w-4 text-violet-500" />
          <h3 className="font-medium">Planification automatique</h3>
        </div>

        <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Activer les sauvegardes planifiées</p>
              <p className="text-xs text-muted-foreground">
                Les sauvegardes seront lancées automatiquement selon le planning défini
              </p>
            </div>
            <button
              onClick={() => setSchedule({ ...schedule, enabled: !schedule.enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                schedule.enabled ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  schedule.enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {schedule.enabled && (
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="client-cron">Sauvegarde client (cron)</Label>
                <Input
                  id="client-cron"
                  value={schedule.clientCron}
                  onChange={(e) => setSchedule({ ...schedule, clientCron: e.target.value })}
                  placeholder="0 2 * * *"
                />
                <p className="text-xs text-muted-foreground">
                  Par défaut : <code className="text-xs bg-muted px-1 rounded">0 2 * * *</code> (tous les jours à 02h00)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="technical-cron">Sauvegarde technique (cron)</Label>
                <Input
                  id="technical-cron"
                  value={schedule.technicalCron}
                  onChange={(e) => setSchedule({ ...schedule, technicalCron: e.target.value })}
                  placeholder="0 3 * * *"
                />
                <p className="text-xs text-muted-foreground">
                  Par défaut : <code className="text-xs bg-muted px-1 rounded">0 3 * * *</code> (tous les jours à 03h00)
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Save button */}
      <div className="flex justify-end pt-4 border-t border-border">
        <Button onClick={handleSaveConfig} disabled={savingConfig}>
          {savingConfig ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : null}
          {savingConfig ? "Enregistrement…" : "Enregistrer les paramètres"}
        </Button>
      </div>

      {/* ======= Section 3: Backup History ======= */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <History className="h-4 w-4 text-purple-500" />
          <h3 className="font-medium">Historique des sauvegardes</h3>
          {historyTotal > 0 && (
            <span className="text-xs text-muted-foreground">({historyTotal})</span>
          )}
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          {["", "client", "technical", "full"].map((f) => (
            <Button
              key={f}
              variant={historyFilter === f ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setHistoryFilter(f);
                loadHistory(1, f);
              }}
            >
              {f === "" ? "Toutes" : f === "client" ? "Client" : f === "technical" ? "Technique" : "Complète"}
            </Button>
          ))}
        </div>

        {loadingHistory ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-4">Aucune sauvegarde dans l&apos;historique.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 font-medium">Statut</th>
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Taille</th>
                    <th className="pb-2 font-medium">Durée</th>
                    <th className="pb-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {history.map((job) => (
                    <tr key={job.id} className="group">
                      <td className="py-2.5">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                          job.type === "client" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" :
                          job.type === "technical" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" :
                          "bg-green-500/10 text-green-600 dark:text-green-400"
                        }`}>
                          {job.type === "client" ? "Client" : job.type === "technical" ? "Technique" : "Complète"}
                        </span>
                      </td>
                      <td className="py-2.5">
                        {job.status === "completed" ? (
                          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span className="text-xs">Terminée</span>
                          </span>
                        ) : job.status === "running" ? (
                          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span className="text-xs">En cours</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-600 dark:text-red-400" title={job.error || undefined}>
                            <XCircle className="h-3.5 w-3.5" />
                            <span className="text-xs">Échouée</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-xs text-muted-foreground">
                        {formatDate(job.startedAt)}
                      </td>
                      <td className="py-2.5 text-xs text-muted-foreground">
                        {formatSize(job.sizeBytes)}
                      </td>
                      <td className="py-2.5 text-xs text-muted-foreground">
                        {formatDuration(job.startedAt, job.completedAt)}
                      </td>
                      <td className="py-2.5 text-right">
                        {job.status === "completed" && job.s3Key && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownload(job.id)}
                              disabled={downloading === job.id}
                              title="Télécharger"
                            >
                              {downloading === job.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setRestoreJobId(job.id); setRestorePassword(""); }}
                              title="Restaurer"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {historyTotalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-muted-foreground">
                  Page {historyPage} sur {historyTotalPages}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={historyPage <= 1}
                    onClick={() => loadHistory(historyPage - 1, historyFilter)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={historyPage >= historyTotalPages}
                    onClick={() => loadHistory(historyPage + 1, historyFilter)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Restore confirmation dialog */}
      {restoreJobId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md space-y-4 shadow-lg">
            <h3 className="text-lg font-semibold text-destructive">Restaurer une sauvegarde</h3>
            <p className="text-sm text-muted-foreground">
              Cette opération va écraser les données actuelles de la base.
              Confirmez en saisissant votre mot de passe administrateur.
            </p>
            <div className="space-y-2">
              <Label htmlFor="restore-password">Mot de passe</Label>
              <Input
                id="restore-password"
                type="password"
                value={restorePassword}
                onChange={(e) => setRestorePassword(e.target.value)}
                placeholder="Votre mot de passe"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") handleRestore(); }}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => { setRestoreJobId(null); setRestorePassword(""); }}
                disabled={restoring}
              >
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={handleRestore}
                disabled={restoring || !restorePassword}
              >
                {restoring ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4 mr-2" />
                )}
                {restoring ? "Restauration…" : "Restaurer"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

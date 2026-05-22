"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle, AlertTriangle, Copy, Trash2, Upload, Loader2, ArrowUpCircle, ExternalLink, Wand2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatDate } from "@/lib/license/gate";

interface LicenseTabProps {
  initialLicense: {
    plan: 'free' | 'growth' | 'enterprise';
    valid: boolean;
    expired: boolean;
    gracePeriod: boolean;
    customerEmail?: string;
    expiresAt?: number;
  } | null;
  isSuperAdmin?: boolean;
  canGenerate?: boolean;
}

export function LicenseTab({ initialLicense, isSuperAdmin: _isSuperAdmin = false, canGenerate = false }: LicenseTabProps) {
  const [license, setLicense] = useState(initialLicense);
  const [jwtInput, setJwtInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Formulaire de génération manuelle (super_admin)
  const [genForm, setGenForm] = useState({
    plan: "enterprise" as "free" | "growth" | "enterprise",
    seats: "999",
    customerEmail: "",
    customerId: "",
    durationDays: "365",
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedJwt, setGeneratedJwt] = useState<string | null>(null);

  const [updateInfo, setUpdateInfo] = useState<{
    updateAvailable: boolean;
    currentVersion?: string;
    latestVersion?: string;
    changelog?: string;
    configured?: boolean;
  } | null>(null);

  const plan = license?.plan ?? "free";
  const customerEmail = license?.customerEmail ?? "N/A";
  const seats = "N/A";
  const expiresAt = license?.expiresAt;
  const isExpired = license?.expired ?? false;
  const isGracePeriod = license?.gracePeriod ?? false;
  const isValid = license?.valid ?? false;

  const daysUntilExpiry = expiresAt
    ? Math.floor((expiresAt - Math.floor(Date.now() / 1000)) / 86400)
    : null;

  // Fetch usage metrics
  const [usageMetrics, setUsageMetrics] = useState<{
    users?: { current: number; max: number; percentage: number };
    spaces?: { current: number; max: number; percentage: number };
  }>({});

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch("/api/admin/licenses/metrics");
        if (res.ok) {
          const data = await res.json();
          setUsageMetrics(data);
        }
      } catch (err) {
        console.error("Failed to fetch usage metrics:", err);
      }
    };

    const fetchUpdateInfo = async () => {
      try {
        const res = await fetch("/api/admin/updates/check");
        if (res.ok) {
          const data = await res.json();
          setUpdateInfo(data);
        }
      } catch (err) {
        console.error("Failed to fetch update info:", err);
      }
    };

    fetchMetrics();
    fetchUpdateInfo();
  }, []);

  const handleImport = async () => {
    if (!jwtInput.trim()) {
      toast.error("Veuillez coller une licence JWT");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/licenses/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jwt: jwtInput }),
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.message || "Erreur lors de l'importation de la licence");
        return;
      }

      const newLicense = await res.json();
      setLicense(newLicense);
      setJwtInput("");
      toast.success("Licence importée avec succès");

      // Refresh metrics
      const metricsRes = await fetch("/api/admin/licenses/metrics");
      if (metricsRes.ok) {
        const data = await metricsRes.json();
        setUsageMetrics(data);
      }
    } catch (err) {
      toast.error("Erreur réseau lors de l'importation");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!genForm.customerEmail || !genForm.customerId) {
      toast.error("L'adresse e-mail et l'identifiant client sont obligatoires");
      return;
    }

    setIsGenerating(true);
    setGeneratedJwt(null);
    try {
      const res = await fetch("/api/admin/licenses/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(genForm),
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.message || "Erreur lors de la génération");
        return;
      }

      const data = await res.json();
      setGeneratedJwt(data.jwt);
      toast.success("Licence générée avec succès");
    } catch (err) {
      toast.error("Erreur réseau lors de la génération");
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyJwt = () => {
    if (!generatedJwt) return;
    navigator.clipboard.writeText(generatedJwt);
    toast.success("Clé de licence copiée");
  };

  const handleRevoke = async () => {
    if (!confirm("Êtes-vous sûr ? Cela supprimera la licence actuelle.")) {
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/licenses/revoke", { method: "POST" });

      if (!res.ok) {
        toast.error("Erreur lors de la révocation");
        return;
      }

      setLicense(null);
      toast.success("Licence révoquée");

      // Refresh metrics
      const metricsRes = await fetch("/api/admin/licenses/metrics");
      if (metricsRes.ok) {
        const data = await metricsRes.json();
        setUsageMetrics(data);
      }
    } catch (err) {
      toast.error("Erreur réseau");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Update notification card */}
      {updateInfo?.updateAvailable && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <ArrowUpCircle className="h-5 w-5" />
              Mise à jour disponible — {updateInfo.latestVersion}
            </CardTitle>
            <CardDescription>
              Vous utilisez la version {updateInfo.currentVersion}. Une nouvelle version est disponible.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3 whitespace-pre-line line-clamp-3">
              {updateInfo.changelog}
            </p>
            <a
              href="https://loriax.fr/docs/mise-a-jour"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Voir les instructions de mise à jour
              <ExternalLink className="h-3 w-3" />
            </a>
          </CardContent>
        </Card>
      )}

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isValid ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-amber-600" />
            )}
            État de la licence
          </CardTitle>
          <CardDescription>
            {isValid
              ? isGracePeriod
                ? "En période de grâce (licence expirée)"
                : "Licence active et valide"
              : "Aucune licence active"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Plan actuel</p>
              <p className="text-lg font-semibold capitalize">{plan}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Client</p>
              <p className="text-lg font-semibold">{customerEmail}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sièges</p>
              <p className="text-lg font-semibold">{seats}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Expiration</p>
              {expiresAt ? (
                <div>
                  <p className="text-lg font-semibold">{formatDate(expiresAt)}</p>
                  <p className="text-xs text-muted-foreground">
                    {daysUntilExpiry !== null && (
                      <>
                        {daysUntilExpiry > 0
                          ? `${daysUntilExpiry} jours restants`
                          : `Expiré depuis ${Math.abs(daysUntilExpiry)} jours`}
                      </>
                    )}
                  </p>
                </div>
              ) : (
                <p className="text-lg font-semibold">—</p>
              )}
            </div>
          </div>

          {isGracePeriod && (
            <Alert className="mt-4 bg-amber-50 border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-900">Période de grâce active</AlertTitle>
              <AlertDescription className="text-amber-800">
                Votre licence a expiré mais vous bénéficiez d&apos;une période de grâce de 14 jours.
                Veuillez renouveler votre licence sous peu.
              </AlertDescription>
            </Alert>
          )}

          {isExpired && !isGracePeriod && (
            <Alert className="mt-4 bg-red-50 border-red-200">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertTitle className="text-red-900">Licence expirée</AlertTitle>
              <AlertDescription className="text-red-800">
                Votre licence a expiré. Les limites du plan Community s&apos;appliquent désormais.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Import Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importer une licence
          </CardTitle>
          <CardDescription>Collez le JWT de votre licence pour l&apos;activer</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="jwt-input">Clé de licence (JWT)</Label>
            <Textarea
              id="jwt-input"
              placeholder="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={jwtInput}
              onChange={(e) => setJwtInput(e.target.value)}
              className="mt-2 font-mono text-xs"
              rows={4}
            />
          </div>
          <Button onClick={handleImport} disabled={isLoading} className="w-full">
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Importer la licence
          </Button>
        </CardContent>
      </Card>

      {/* Usage Metrics Card */}
      <Card>
        <CardHeader>
          <CardTitle>Utilisation du quota</CardTitle>
          <CardDescription>Utilisation actuelle par rapport aux limites du plan</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Users */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <Label>Utilisateurs</Label>
              <span className="text-sm font-semibold">
                {usageMetrics.users?.current ?? "—"} / {usageMetrics.users?.max ?? "—"}
              </span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all ${
                  (usageMetrics.users?.percentage ?? 0) > 90
                    ? "bg-red-500"
                    : (usageMetrics.users?.percentage ?? 0) > 70
                      ? "bg-amber-500"
                      : "bg-green-500"
                }`}
                style={{
                  width: `${Math.min(usageMetrics.users?.percentage ?? 0, 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Spaces */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <Label>Espaces</Label>
              <span className="text-sm font-semibold">
                {usageMetrics.spaces?.current ?? "—"} / {usageMetrics.spaces?.max ?? "—"}
              </span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all ${
                  (usageMetrics.spaces?.percentage ?? 0) > 90
                    ? "bg-red-500"
                    : (usageMetrics.spaces?.percentage ?? 0) > 70
                      ? "bg-amber-500"
                      : "bg-green-500"
                }`}
                style={{
                  width: `${Math.min(usageMetrics.spaces?.percentage ?? 0, 100)}%`,
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Génération manuelle — super_admin */}
      {canGenerate && (
        <Card className="border-purple-200 dark:border-purple-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
              <Wand2 className="h-5 w-5" />
              Générer une licence
            </CardTitle>
            <CardDescription>Créer une clé de licence signée — réservé au super-administrateur</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select
                  value={genForm.plan}
                  onValueChange={(v) => setGenForm((f) => ({ ...f, plan: v as typeof f.plan }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="growth">Growth</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="gen-seats">Sièges</Label>
                <Input
                  id="gen-seats"
                  type="number"
                  min={1}
                  value={genForm.seats}
                  onChange={(e) => setGenForm((f) => ({ ...f, seats: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gen-email">E-mail client</Label>
                <Input
                  id="gen-email"
                  type="email"
                  placeholder="client@exemple.fr"
                  value={genForm.customerEmail}
                  onChange={(e) => setGenForm((f) => ({ ...f, customerEmail: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gen-id">Identifiant client</Label>
                <Input
                  id="gen-id"
                  placeholder="client-001"
                  value={genForm.customerId}
                  onChange={(e) => setGenForm((f) => ({ ...f, customerId: e.target.value }))}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="gen-duration">Durée (jours)</Label>
                <Input
                  id="gen-duration"
                  type="number"
                  min={1}
                  value={genForm.durationDays}
                  onChange={(e) => setGenForm((f) => ({ ...f, durationDays: e.target.value }))}
                />
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isGenerating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Wand2 className="h-4 w-4 mr-2" />
              Générer la licence
            </Button>

            {generatedJwt && (
              <div className="space-y-2">
                <Label>Clé de licence générée</Label>
                <Textarea
                  readOnly
                  value={generatedJwt}
                  className="font-mono text-xs"
                  rows={4}
                />
                <Button variant="outline" className="w-full" onClick={handleCopyJwt}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copier la clé
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions Card */}
      {license && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600">Actions dangerouses</CardTitle>
            <CardDescription>Ces actions ne peuvent pas être annulées</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleRevoke}
              disabled={isLoading}
              variant="destructive"
              className="w-full"
            >
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Trash2 className="h-4 w-4 mr-2" />
              Révoquer la licence
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

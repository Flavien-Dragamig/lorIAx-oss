"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { CLOUD_PRICES_EUR } from "@/lib/billing/plans";
import { Check, ExternalLink } from "lucide-react";

interface SubscriptionTabProps {
  currentPlan: string;
  orgSlug: string;
  memberCount: number;
}

const PLAN_LABELS: Record<string, string> = {
  free: "Gratuit",
  growth: "Growth",
  enterprise: "Enterprise",
  // Alias historiques affichés correctement le temps de la bascule
  community: "Gratuit",
  starter: "Growth",
  pro: "Growth",
  team: "Growth",
};

const GROWTH_FEATURES = [
  "Utilisateurs et espaces illimités",
  "50 Go de stockage",
  "SSO SAML 2.0",
  "Audit log basique",
  "Logo personnalisé",
  "Support email sous 48 h",
];

const ENTERPRISE_FEATURES = [
  "Stockage et IA sur mesure",
  "SLA garanti 99,9 %",
  "Audit log complet + rétention longue",
  "White label",
  "SCIM, contrat DPA, formation",
  "Onboarding dédié",
];

export function SubscriptionTab({ currentPlan, orgSlug, memberCount }: SubscriptionTabProps) {
  const licenseManagerUrl =
    process.env.NEXT_PUBLIC_LICENSE_MANAGER_URL || "https://licences.loriax.fr";
  const enterpriseContactUrl =
    process.env.NEXT_PUBLIC_ENTERPRISE_CONTACT_URL || "https://loriax.fr/enterprise";

  const seats = Math.max(1, memberCount);

  function handleUpgradeGrowth() {
    const url = `${licenseManagerUrl}/saas/checkout?org=${encodeURIComponent(orgSlug)}&plan=growth&seats=${seats}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function handleContactEnterprise() {
    window.open(enterpriseContactUrl, "_blank", "noopener,noreferrer");
  }

  function handleManage() {
    const url = `${licenseManagerUrl}/saas/portal?org=${encodeURIComponent(orgSlug)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const planLabel = PLAN_LABELS[currentPlan] ?? currentPlan;
  const isFreeTier = currentPlan === "free" || currentPlan === "community";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Abonnement</h2>
        <p className="text-sm text-muted-foreground">
          Gérez votre plan et votre facturation.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Plan actuel</CardTitle>
            <Badge variant="secondary">{planLabel}</Badge>
          </div>
          <CardDescription>
            {isFreeTier
              ? "5 utilisateurs, 2 espaces, 1 Go de stockage"
              : `Plan ${planLabel}`}
          </CardDescription>
        </CardHeader>
        {!isFreeTier && (
          <CardContent>
            <Button variant="outline" size="sm" onClick={handleManage}>
              Gérer la facturation <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        )}
      </Card>

      {isFreeTier && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="hover:border-primary transition-colors">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Growth</CardTitle>
              <p className="text-2xl font-bold">
                {CLOUD_PRICES_EUR.growth} €
                <span className="text-sm font-normal text-muted-foreground">
                  /utilisateur/mois
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                ou 7,50 €/utilisateur/mois en annuel — 2 mois offerts
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="text-sm text-muted-foreground space-y-1.5">
                {GROWTH_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button size="sm" className="w-full" onClick={handleUpgradeGrowth}>
                Passer à Growth
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                {seats} {seats > 1 ? "membres" : "membre"} · soit{" "}
                {seats * CLOUD_PRICES_EUR.growth} €/mois
              </p>
            </CardContent>
          </Card>

          <Card className="hover:border-primary transition-colors">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Enterprise</CardTitle>
              <p className="text-2xl font-bold">
                Sur devis
                <span className="text-sm font-normal text-muted-foreground">
                  {" "}— à partir de 150 €/mois
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                Pour les organisations à fortes exigences
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="text-sm text-muted-foreground space-y-1.5">
                {ENTERPRISE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={handleContactEnterprise}
              >
                Contacter l&apos;équipe
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

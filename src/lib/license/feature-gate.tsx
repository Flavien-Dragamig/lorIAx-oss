/**
 * Feature gate component
 * Conditionally renders content based on license features
 */

"use client";

import { ReactNode } from "react";
import { Feature } from "./types";
import { useLicense } from "./license-context";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface FeatureGateProps {
  feature: Feature;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Renders children if feature is available, otherwise renders fallback
 * Default fallback is an upgrade prompt banner
 */
export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const { hasFeature } = useLicense();

  if (!hasFeature(feature)) {
    return fallback ?? <UpgradePrompt feature={feature} />;
  }

  return children;
}

/**
 * Default upgrade prompt shown when a feature is not available
 */
function UpgradePrompt({ feature }: { feature: Feature }) {
  const featureLabels: Record<string, string> = {
    sso: "Single Sign-On (SAML/OIDC)",
    audit_log: "Audit trail et compliance",
    custom_branding: "Personnalisation de la marque",
    ai_advanced: "Modèles IA avancés",
    api_access: "Accès API public",
    scim: "Provisioning SCIM",
    ha_cluster: "Haute disponibilité",
    white_label: "Déploiement en marque blanche",
  };

  const label = featureLabels[feature] || feature;

  return (
    <Alert className="bg-amber-50 border-amber-200">
      <AlertCircle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-900">Fonctionnalité non disponible</AlertTitle>
      <AlertDescription className="text-amber-800 mt-2 space-y-3">
        <p>
          <strong>{label}</strong> est disponible uniquement sur les plans Team et Enterprise.
        </p>
        <div className="flex gap-2 mt-3">
          <Button size="sm" variant="outline" className="text-amber-700 border-amber-300 hover:bg-amber-100">
            Découvrir les plans
          </Button>
          <Button size="sm" variant="outline" className="text-amber-700 border-amber-300 hover:bg-amber-100">
            Contacter le support
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

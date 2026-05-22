/**
 * License plans and feature limits
 * Defines quotas and available features for each plan tier
 */

import { Plan, Feature } from "./types";

// Usage limits per plan
export const FREE_LIMITS = {
  users: 5,
  spaces: 2,
  storage_gb: 1,
};

export const GROWTH_LIMITS = {
  users: Infinity,
  spaces: Infinity,
  storage_gb: 50,
};

export const ENTERPRISE_LIMITS = {
  users: Infinity,
  spaces: Infinity,
  storage_gb: Infinity,
};

// Plan registry
export const PLANS: Record<Plan, { users: number; spaces: number; storage_gb: number }> = {
  free: FREE_LIMITS,
  growth: GROWTH_LIMITS,
  enterprise: ENTERPRISE_LIMITS,
};

// Features available per plan
export const FEATURES_BY_PLAN: Record<Plan, Feature[]> = {
  free: [],
  growth: ["sso", "audit_log", "custom_branding"],
  enterprise: [
    "sso",
    "audit_log",
    "custom_branding",
    "ai_advanced",
    "api_access",
    "scim",
    "ha_cluster",
    "white_label",
  ],
};

// Feature display names
export const FEATURE_LABELS: Record<Feature, string> = {
  sso: "Single Sign-On (SAML/OIDC)",
  audit_log: "Audit trail et compliance",
  custom_branding: "Personnalisation de la marque",
  ai_advanced: "Modèles IA avancés",
  api_access: "Accès API public",
  scim: "Provisioning SCIM",
  ha_cluster: "Haute disponibilité",
  white_label: "Déploiement en marque blanche",
};

export type PlanId = "free" | "growth" | "enterprise";

export interface PlanLimits {
  maxUsers: number | null;
  maxSpaces: number | null;
  maxStorageGB: number;
  features: string[];
}

export const PLANS: Record<PlanId, PlanLimits> = {
  free: {
    maxUsers: 5,
    maxSpaces: 2,
    maxStorageGB: 1,
    features: ["oauth"],
  },
  growth: {
    maxUsers: null,
    maxSpaces: null,
    maxStorageGB: 50,
    features: ["oauth", "saml", "custom-branding", "audit-log"],
  },
  enterprise: {
    maxUsers: null,
    maxSpaces: null,
    maxStorageGB: 1000,
    features: [
      "oauth",
      "saml",
      "custom-branding",
      "audit-log",
      "audit-log-retention",
      "sla",
      "white-label",
    ],
  },
};

export const RESERVED_SLUGS = [
  "www",
  "app",
  "api",
  "admin",
  "static",
  "mail",
  "licences",
  "login",
  "signup",
  "onboarding",
  "billing",
  "checkout",
  "support",
];

// Alias historiques (community = self-hosted gratuit ; starter/pro/team = ancienne grille)
const PLAN_ALIASES: Record<string, PlanId> = {
  community: "free",
  starter: "growth",
  pro: "growth",
  team: "growth",
};

export function resolvePlanId(plan: string): PlanId {
  if (plan in PLANS) return plan as PlanId;
  if (plan in PLAN_ALIASES) return PLAN_ALIASES[plan];
  return "free";
}

export function getPlanLimits(plan: string): PlanLimits {
  return PLANS[resolvePlanId(plan)];
}

// Prix Cloud SaaS par utilisateur/mois (paiement via Stripe sur licences.loriax.fr/saas/checkout)
// Stratégie d'entrée agressive : tarification par siège, sous Notion/Confluence.
export const CLOUD_PRICES_EUR: Record<Exclude<PlanId, "free" | "enterprise">, number> = {
  growth: 9,
};

// Prix Self-hosted par siège/mois (licence JWT sur licences.loriax.fr/checkout)
// Stratégie d'entrée agressive : 5€/siège pour casser le marché et maximiser l'adoption.
export const SELFHOSTED_PRICES_EUR: Record<Exclude<PlanId, "free" | "enterprise">, number> = {
  growth: 5,
};

// Conservé pour compatibilité — pointe désormais sur la grille Cloud
export const PLAN_PRICES_EUR = CLOUD_PRICES_EUR;

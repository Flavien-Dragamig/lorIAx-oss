/**
 * License types and interfaces
 */

export type Plan = "free" | "growth" | "enterprise";

export type Feature =
  | "sso"
  | "audit_log"
  | "custom_branding"
  | "ai_advanced"
  | "api_access"
  | "scim"
  | "ha_cluster"
  | "white_label";

/**
 * Decoded JWT payload from license
 */
export interface LicensePayload {
  plan: Plan;
  seats: number;
  customerEmail: string;
  customerId: string;
  issuedAt: number; // Unix timestamp (seconds)
  expiresAt: number; // Unix timestamp (seconds)
  features: Feature[];
}

/**
 * Fully decoded and validated license
 */
export interface License {
  payload: LicensePayload;
  raw: string; // JWT string
  expired: boolean; // true if current time > expiresAt
  gracePeriod: boolean; // true if expired but < 14 days past expiration
  valid: boolean; // true if !expired || gracePeriod
}

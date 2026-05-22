/**
 * Feature gating and limit checking
 * Determines which features and quotas are available for a license
 */

import { License, Plan, Feature } from "./types";
import { FEATURES_BY_PLAN, PLANS } from "./constants";

/**
 * Checks if a feature is available for the given license
 * Returns false if license is null or feature not included in plan
 */
export function hasFeature(license: License | null, feature: Feature): boolean {
  if (!license || !license.valid) {
    return false;
  }

  const allowedFeatures = FEATURES_BY_PLAN[license.payload.plan];
  return allowedFeatures.includes(feature);
}

/**
 * Gets the usage limit for a given metric
 * Falls back to 'community' plan if no license provided
 */
export function getLimit(
  license: License | null,
  limit: "users" | "spaces" | "storage_gb"
): number {
  const plan = getPlan(license);
  return PLANS[plan][limit];
}

/**
 * Gets the current plan tier
 * Returns 'community' if no valid license
 */
export function getPlan(license: License | null): Plan {
  if (!license || !license.valid) {
    return "free";
  }
  return license.payload.plan;
}

/**
 * Checks if a license is in grace period
 * Grace period = expired but < 14 days past expiration
 */
export function isInGracePeriod(license: License | null): boolean {
  return license?.gracePeriod ?? false;
}

/**
 * Gets days remaining until license expiration
 * Negative value = already expired
 */
export function getDaysUntilExpiration(license: License | null): number {
  if (!license) {
    return Infinity; // No license = perpetual community plan
  }

  const now = Math.floor(Date.now() / 1000);
  const secondsRemaining = license.payload.expiresAt - now;
  return Math.floor(secondsRemaining / 86400);
}

/**
 * Formats a date for display (ISO 8601)
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().split("T")[0];
}

/**
 * License context and provider
 * Provides license information to client components via React context
 */

"use client";

import { createContext, useContext, ReactNode } from "react";
import { Plan, Feature } from "./types";
import type { License } from "./types";
import { hasFeature as checkFeature, getLimit, getDaysUntilExpiration } from "./gate";

export interface LicenseContextType {
  plan: Plan;
  valid: boolean;
  expired: boolean;
  gracePeriod: boolean;
  customerEmail?: string;
  expiresAt?: number;
  hasFeature: (feature: Feature) => boolean;
  getLimit: (limit: "users" | "spaces" | "storage_gb") => number;
  getDaysUntilExpiration: () => number;
}

const LicenseContext = createContext<LicenseContextType | null>(null);

/**
 * Hook to access license information in client components
 * Throws if used outside LicenseProvider
 */
export function useLicense(): LicenseContextType {
  const ctx = useContext(LicenseContext);
  if (!ctx) {
    throw new Error("useLicense() must be called inside <LicenseProvider>");
  }
  return ctx;
}

/**
 * Provider component for license context
 * Wraps application with license information
 */
export function LicenseProvider({
  children,
  licenseData,
}: {
  children: ReactNode;
  licenseData: {
    plan: Plan;
    valid: boolean;
    expired: boolean;
    gracePeriod: boolean;
    customerEmail?: string;
    expiresAt?: number;
  } | null;
}) {
  const plan = licenseData?.plan ?? "free";
  const valid = licenseData?.valid ?? false;
  const expired = licenseData?.expired ?? false;
  const gracePeriod = licenseData?.gracePeriod ?? false;

  const value: LicenseContextType = {
    plan,
    valid,
    expired,
    gracePeriod,
    customerEmail: licenseData?.customerEmail,
    expiresAt: licenseData?.expiresAt,
    hasFeature: (feature: Feature) => checkFeature({ payload: { plan, seats: 0, customerEmail: "", customerId: "", issuedAt: 0, expiresAt: 0, features: [] }, raw: "", expired: false, gracePeriod: false, valid: true } satisfies License, feature),
    getLimit: (limit: "users" | "spaces" | "storage_gb") => getLimit({ payload: { plan, seats: 0, customerEmail: "", customerId: "", issuedAt: 0, expiresAt: 0, features: [] }, raw: "", expired: false, gracePeriod: false, valid: true } satisfies License, limit),
    getDaysUntilExpiration: () => getDaysUntilExpiration(null),
  };

  return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>;
}

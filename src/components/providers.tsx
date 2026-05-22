"use client";

import { SessionProvider } from "next-auth/react";
import { AppearanceProvider } from "./appearance-provider";
import { LicenseProvider } from "@/lib/license/license-context";
import { ThemeProvider } from "@/contexts/theme-context";
import type { ReactNode } from "react";

interface ProvidersProps {
  children: ReactNode;
  licenseData?: {
    plan: "free" | "growth" | "enterprise";
    valid: boolean;
    expired: boolean;
    gracePeriod: boolean;
    customerEmail?: string;
    expiresAt?: number;
  } | null;
}

export function Providers({ children, licenseData }: ProvidersProps) {
  return (
    <ThemeProvider>
      <SessionProvider>
        <LicenseProvider licenseData={licenseData ?? null}>
          <AppearanceProvider>{children}</AppearanceProvider>
        </LicenseProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}

import { LicenseTab } from "./license-tab";
import { getLicenseForClient } from "@/lib/license/get-license-for-client";
import { getSessionUser } from "@/lib/auth/get-user";
import { validateEnv } from "@/lib/env";

export const metadata = {
  title: "Gestion des licences",
};

export default async function LicensePage() {
  const [licenseData, user] = await Promise.all([
    getLicenseForClient(),
    getSessionUser(),
  ]);

  const isSuperAdmin = user?.globalRole === "super_admin";

  // Indique si la génération manuelle est possible (clé privée configurée)
  let canGenerate = false;
  try {
    const env = validateEnv();
    canGenerate = isSuperAdmin && !!env.LICENSE_PRIVATE_KEY;
  } catch {
    // env invalide — pas de génération
  }

  return <LicenseTab initialLicense={licenseData} isSuperAdmin={isSuperAdmin} canGenerate={canGenerate} />;
}

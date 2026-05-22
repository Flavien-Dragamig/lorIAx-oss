/**
 * GET /api/admin/updates/check
 * Vérifie si une mise à jour est disponible auprès du license manager.
 * Résultat mis en cache 24h dans system_settings.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { validateEnv } from "@/lib/env";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user || !hasGlobalRole(user.globalRole, "admin")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const env = validateEnv();

    // Retourner directement si pas de license manager configuré
    if (!env.LICENSE_MANAGER_URL) {
      return NextResponse.json({ updateAvailable: false, configured: false });
    }

    // Vérifier le cache dans system_settings
    const cached = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, "update_check"))
      .limit(1);

    if (cached.length > 0) {
      const data = cached[0].value as {
        checkedAt: string;
        latestVersion: string;
        updateAvailable: boolean;
        changelog: string;
        currentVersion: string;
      };
      const age = Date.now() - new Date(data.checkedAt).getTime();
      if (age < CACHE_TTL_MS) {
        return NextResponse.json({ ...data, fromCache: true });
      }
    }

    // Interroger le license manager
    const res = await fetch(`${env.LICENSE_MANAGER_URL}/api/releases/latest`, {
      next: { revalidate: 0 },
    });

    const currentVersion = process.env.APP_VERSION ?? "dev";

    if (!res.ok) {
      return NextResponse.json({ updateAvailable: false, currentVersion });
    }

    const latest = (await res.json()) as {
      version: string;
      changelog: string;
      publishedAt: string;
    };

    // Comparaison de version simple (strip préfixe 'v')
    const updateAvailable =
      latest.version !== currentVersion && latest.version > currentVersion;

    const result = {
      currentVersion,
      latestVersion: latest.version,
      updateAvailable,
      changelog: latest.changelog,
      checkedAt: new Date().toISOString(),
    };

    // Mettre à jour le cache dans system_settings
    await db
      .insert(systemSettings)
      .values({ key: "update_check", value: result })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: result, updatedAt: new Date() },
      });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({
      updateAvailable: false,
      currentVersion: process.env.APP_VERSION ?? "dev",
    });
  }
}

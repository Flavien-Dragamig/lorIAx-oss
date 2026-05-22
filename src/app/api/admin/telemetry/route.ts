import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";
import { z } from "zod";

const SETTINGS_KEY = "telemetry";

interface TelemetrySettings {
  enabled: boolean;
  contactEmail: string | null;
  instanceId: string;
}

const putSchema = z.object({
  enabled: z.boolean(),
  contactEmail: z.string().email().max(255).nullable(),
});

async function readSettings(): Promise<TelemetrySettings | null> {
  const [row] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, SETTINGS_KEY));
  return (row?.value as TelemetrySettings) ?? null;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const settings = await readSettings();
  return NextResponse.json(
    settings ?? { enabled: false, contactEmail: null, instanceId: null }
  );
}

export async function PUT(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const parsed = putSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const existing = await readSettings();
  // instanceId généré une seule fois, persistant — aucun lien avec domaine/IP.
  const instanceId = existing?.instanceId ?? randomUUID();

  const value: TelemetrySettings = {
    enabled: parsed.data.enabled,
    contactEmail: parsed.data.contactEmail,
    instanceId,
  };

  await db
    .insert(systemSettings)
    .values({ key: SETTINGS_KEY, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value, updatedAt: new Date() },
    });

  // Recharger le planificateur pour appliquer le changement immédiatement.
  const { reloadTelemetryScheduler } = await import(
    "@/lib/telemetry/scheduler"
  );
  await reloadTelemetryScheduler();

  return NextResponse.json(value);
}

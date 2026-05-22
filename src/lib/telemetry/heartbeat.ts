import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { systemSettings, users, organizations, spaces } from "@/lib/db/schema";
import logger from "@/lib/logger";

export interface TelemetrySettings {
  enabled: boolean;
  contactEmail: string | null;
  instanceId: string;
}

export interface InstanceMetrics {
  users: number;
  orgs: number;
  spaces: number;
}

export interface HeartbeatPayload {
  instance_id: string;
  version: string;
  contact_email: string | null;
  metrics: InstanceMetrics;
}

/** Construit le payload du heartbeat — fonction pure, testable. */
export function buildHeartbeatPayload(
  settings: TelemetrySettings,
  version: string,
  metrics: InstanceMetrics
): HeartbeatPayload {
  return {
    instance_id: settings.instanceId,
    version,
    contact_email: settings.contactEmail,
    metrics,
  };
}

/** Lit les réglages de télémétrie depuis system_settings. */
export async function getTelemetrySettings(): Promise<TelemetrySettings | null> {
  const [row] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, "telemetry"));
  return (row?.value as TelemetrySettings) ?? null;
}

/** Compte les utilisateurs, organisations et espaces de l'instance. */
export async function getInstanceMetrics(): Promise<InstanceMetrics> {
  const [u] = await db.select({ c: sql<number>`count(*)::int` }).from(users);
  const [o] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(organizations);
  const [s] = await db.select({ c: sql<number>`count(*)::int` }).from(spaces);
  return { users: u.c, orgs: o.c, spaces: s.c };
}

/**
 * Envoie le heartbeat si la télémétrie est activée. Échec réseau silencieux —
 * jamais bloquant, retenté au prochain cycle du planificateur.
 */
export async function sendHeartbeat(): Promise<void> {
  const settings = await getTelemetrySettings();
  if (!settings?.enabled) return;

  const endpoint =
    process.env.TELEMETRY_ENDPOINT ?? "https://licences.loriax.fr/api/telemetry";
  const version = process.env.APP_VERSION ?? "dev";

  try {
    const metrics = await getInstanceMetrics();
    const payload = buildHeartbeatPayload(settings, version, metrics);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, "[telemetry] heartbeat rejeté");
    }
  } catch (err) {
    logger.warn({ err }, "[telemetry] échec d'envoi du heartbeat");
  }
}

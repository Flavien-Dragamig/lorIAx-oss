import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";
import { encrypt } from "@/lib/crypto";
import { auditLog } from "@/lib/audit/log";
import { getClientIp } from "@/lib/rate-limit";

const VALID_KEYS = [
  "general",
  "auth",
  "smtp",
  "email",
  "ldap",
  "livekit",
  "collab",
  "rolePermissions",
  "whisper",
  "ollama",
  "ai_global",
  "ai_alerts",
  "backup_s3",
  "backup_schedule",
  "meeting_rooms_enabled",
] as const;

type SettingsKey = (typeof VALID_KEYS)[number];

function isValidKey(key: string): key is SettingsKey {
  return (VALID_KEYS as readonly string[]).includes(key);
}

export async function GET() {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const rows = await db.select().from(systemSettings);

  const settings: Record<string, unknown> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }

  return NextResponse.json(settings);
}

export async function PUT(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json();

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const now = new Date();

  // Champs sensibles à chiffrer avant stockage
  const SENSITIVE_FIELDS: Record<string, string[]> = {
    ldap: ["ldapBindPassword"],
    email: ["smtpPassword", "resendApiKey"],
    smtp: ["smtpPassword"],
    backup_s3: ["s3BackupSecretKey"],
  };

  for (const [key, value] of Object.entries(body)) {
    if (!isValidKey(key)) continue;

    // Chiffrer les champs sensibles si présents
    let processedValue = value;
    const sensitiveKeys = SENSITIVE_FIELDS[key];
    if (sensitiveKeys && typeof value === "object" && value !== null) {
      processedValue = { ...value as Record<string, unknown> };
      for (const field of sensitiveKeys) {
        const fieldValue = (processedValue as Record<string, unknown>)[field];
        if (typeof fieldValue === "string" && fieldValue.length > 0) {
          // Ne pas re-chiffrer si déjà chiffré (format iv:tag:cipher)
          if (!/^[0-9a-f]{32}:[0-9a-f]{32}:/.test(fieldValue)) {
            (processedValue as Record<string, unknown>)[field] = encrypt(fieldValue);
          }
        }
      }
    }

    await db
      .insert(systemSettings)
      .values({ key, value: processedValue, updatedAt: now })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: processedValue, updatedAt: now },
      });
  }

  // Journal d'audit
  auditLog(
    "settings.update",
    user.id,
    { keys: Object.keys(body).filter(isValidKey) },
    getClientIp(request)
  );

  return NextResponse.json({ success: true });
}

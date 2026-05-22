import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";

const AI_SETTINGS_KEYS = [
  "ai_global",
  "ai_alerts",
  "rolePermissions",
  "whisper",
  "ollama",
  "transcription",
  "voxtral",
] as const;

type AISettingsKey = (typeof AI_SETTINGS_KEYS)[number];

function isValidKey(key: string): key is AISettingsKey {
  return (AI_SETTINGS_KEYS as readonly string[]).includes(key);
}

export async function GET() {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const rows = await db.select().from(systemSettings);

  const settings: Record<string, unknown> = {};
  for (const row of rows) {
    if (isValidKey(row.key)) {
      settings[row.key] = row.value;
    }
  }

  return NextResponse.json(settings);
}

export async function PUT(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const body = await request.json();

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const now = new Date();

  for (const [key, value] of Object.entries(body)) {
    if (!isValidKey(key)) continue;

    await db
      .insert(systemSettings)
      .values({ key, value, updatedAt: now })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value, updatedAt: now },
      });
  }

  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";

const SETTING_KEY = "slash_command_aliases";

export async function GET() {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin"))
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const row = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, SETTING_KEY))
    .then((rows) => rows[0] ?? null);

  return NextResponse.json((row?.value as Record<string, string[]>) ?? {});
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin"))
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const body = await req.json();
  if (typeof body !== "object" || body === null || Array.isArray(body))
    return NextResponse.json({ error: "Format invalide" }, { status: 400 });

  // Validate: each value must be an array of strings
  for (const [, v] of Object.entries(body)) {
    if (!Array.isArray(v) || v.some((a) => typeof a !== "string"))
      return NextResponse.json({ error: "Format invalide" }, { status: 400 });
  }

  await db
    .insert(systemSettings)
    .values({ key: SETTING_KEY, value: body })
    .onConflictDoUpdate({ target: systemSettings.key, set: { value: body, updatedAt: new Date() } });

  return NextResponse.json(body);
}

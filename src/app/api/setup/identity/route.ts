// src/app/api/setup/identity/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { guardSetupNotCompleted } from "@/lib/setup/guards";

export async function POST(request: NextRequest) {
  const blocked = await guardSetupNotCompleted();
  if (blocked) return blocked;

  const body = await request.json();
  const { name, description, logoUrl, faviconUrl } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json(
      { error: "Le nom de l'organisation est obligatoire" },
      { status: 400 }
    );
  }

  const now = new Date();
  const entries: Array<{ key: string; value: unknown }> = [
    { key: "org_name", value: name.trim() },
    { key: "org_description", value: description?.trim() || "" },
  ];

  // Only store logo/favicon if provided (avoid SQL null on jsonb NOT NULL column)
  if (logoUrl) entries.push({ key: "org_logo_url", value: logoUrl });
  if (faviconUrl) entries.push({ key: "org_favicon_url", value: faviconUrl });

  for (const entry of entries) {
    await db
      .insert(systemSettings)
      .values({ key: entry.key, value: entry.value, updatedAt: now })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: entry.value, updatedAt: now },
      });
  }

  return NextResponse.json({ success: true });
}

// src/app/api/setup/context/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { guardSetupNotCompleted } from "@/lib/setup/guards";

export async function POST(request: NextRequest) {
  const blocked = await guardSetupNotCompleted();
  if (blocked) return blocked;

  const body = await request.json();
  const { website, sector, presentation, values } = body;

  const contextData = {
    website: website?.trim() || "",
    sector: sector?.trim() || "",
    presentation: presentation?.trim() || "",
    values: values?.trim() || "",
  };

  const now = new Date();
  await db
    .insert(systemSettings)
    .values({ key: "org_context", value: contextData, updatedAt: now })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value: contextData, updatedAt: now },
    });

  return NextResponse.json({ success: true });
}

// src/app/api/setup/complete/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { systemSettings, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { guardSetupNotCompleted } from "@/lib/setup/guards";

export async function POST() {
  const blocked = await guardSetupNotCompleted();
  if (blocked) return blocked;

  // Vérifier qu'un super admin a été créé avant de finaliser
  const [adminRow] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.globalRole, "super_admin"))
    .limit(1);

  if (!adminRow) {
    return NextResponse.json(
      { error: "Un super administrateur doit être créé avant de finaliser la configuration" },
      { status: 400 }
    );
  }

  const now = new Date();
  await db
    .insert(systemSettings)
    .values({ key: "setup_completed", value: true, updatedAt: now })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value: true, updatedAt: now },
    });

  return NextResponse.json({ success: true });
}

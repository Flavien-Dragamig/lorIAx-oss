import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aiModelAssignments } from "@/lib/db/schema-ai";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";

export async function GET() {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const assignments = await db.select().from(aiModelAssignments);

  return NextResponse.json(assignments);
}

export async function PUT(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json();
  const {
    usageType,
    providerId,
    model,
    fallbackProviderId,
    fallbackModel,
    timeoutSeconds,
    maxRetries,
    isEnabled,
  } = body;

  if (!usageType || !providerId || !model) {
    return NextResponse.json(
      { error: "usageType, providerId et model sont requis" },
      { status: 400 }
    );
  }

  // Check if assignment already exists for this usage type
  const [existing] = await db
    .select()
    .from(aiModelAssignments)
    .where(eq(aiModelAssignments.usageType, usageType))
    .limit(1);

  if (existing) {
    // Update
    await db
      .update(aiModelAssignments)
      .set({
        providerId,
        model,
        fallbackProviderId: fallbackProviderId || null,
        fallbackModel: fallbackModel || null,
        timeoutSeconds: timeoutSeconds ?? 30,
        maxRetries: maxRetries ?? 1,
        isEnabled: isEnabled ?? true,
        updatedAt: new Date(),
      })
      .where(eq(aiModelAssignments.id, existing.id));
  } else {
    // Insert
    await db.insert(aiModelAssignments).values({
      usageType,
      providerId,
      model,
      fallbackProviderId: fallbackProviderId || null,
      fallbackModel: fallbackModel || null,
      timeoutSeconds: timeoutSeconds ?? 30,
      maxRetries: maxRetries ?? 1,
      isEnabled: isEnabled ?? true,
    });
  }

  return NextResponse.json({ success: true });
}

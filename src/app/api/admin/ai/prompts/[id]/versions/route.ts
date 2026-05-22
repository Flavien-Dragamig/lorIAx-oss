import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aiPromptVersions } from "@/lib/db/schema-ai";
import { eq, desc, sql } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;

  const versions = await db
    .select()
    .from(aiPromptVersions)
    .where(eq(aiPromptVersions.promptId, id))
    .orderBy(desc(aiPromptVersions.versionNumber));

  return NextResponse.json(versions);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const {
    systemPrompt,
    userPromptTemplate,
    variables,
    changeNote,
    isActive,
    trafficPercentage,
  } = body;

  if (!systemPrompt || !changeNote) {
    return NextResponse.json(
      { error: "systemPrompt et changeNote sont obligatoires" },
      { status: 400 }
    );
  }

  // Auto-increment version number
  const [maxVersion] = await db
    .select({
      maxNum: sql<number>`coalesce(max(${aiPromptVersions.versionNumber}), 0)::int`,
    })
    .from(aiPromptVersions)
    .where(eq(aiPromptVersions.promptId, id));

  const nextVersion = (maxVersion?.maxNum ?? 0) + 1;

  const [version] = await db
    .insert(aiPromptVersions)
    .values({
      promptId: id,
      versionNumber: nextVersion,
      systemPrompt,
      userPromptTemplate: userPromptTemplate || null,
      variables: variables || [],
      isActive: isActive ?? false,
      trafficPercentage: trafficPercentage ?? 100,
      changeNote,
      createdBy: user.id,
    })
    .returning();

  return NextResponse.json(version, { status: 201 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  await params; // consume params
  const body = await request.json();
  const { versionId, isActive, trafficPercentage } = body;

  if (!versionId) {
    return NextResponse.json({ error: "versionId requis" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (isActive !== undefined) updates.isActive = isActive;
  if (trafficPercentage !== undefined) updates.trafficPercentage = trafficPercentage;

  await db
    .update(aiPromptVersions)
    .set(updates)
    .where(eq(aiPromptVersions.id, versionId));

  return NextResponse.json({ success: true });
}

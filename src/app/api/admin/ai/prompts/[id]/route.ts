import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aiPrompts, aiPromptVersions } from "@/lib/db/schema-ai";
import { eq, desc } from "drizzle-orm";
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

  const [prompt] = await db
    .select()
    .from(aiPrompts)
    .where(eq(aiPrompts.id, id));

  if (!prompt) {
    return NextResponse.json({ error: "Prompt introuvable" }, { status: 404 });
  }

  const versions = await db
    .select()
    .from(aiPromptVersions)
    .where(eq(aiPromptVersions.promptId, id))
    .orderBy(desc(aiPromptVersions.versionNumber));

  return NextResponse.json({ ...prompt, versions });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { name, description, isActive } = body;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (isActive !== undefined) updates.isActive = isActive;

  await db.update(aiPrompts).set(updates).where(eq(aiPrompts.id, id));

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;

  await db.delete(aiPrompts).where(eq(aiPrompts.id, id));

  return NextResponse.json({ success: true });
}

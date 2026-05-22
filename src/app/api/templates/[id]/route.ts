import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { templates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";
import { z } from "zod";
import { getBuiltinTemplateById } from "@/lib/templates/builtin";

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  content: z.any().optional(),
  icon: z.string().optional(),
  category: z.string().optional(),
  isGlobal: z.boolean().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;

  if (id.startsWith("builtin_")) {
    const builtin = getBuiltinTemplateById(id);
    if (!builtin) return NextResponse.json({ error: "Template introuvable" }, { status: 404 });
    return NextResponse.json(builtin);
  }

  const [template] = await db
    .select()
    .from(templates)
    .where(eq(templates.id, id))
    .limit(1);

  if (!template) {
    return NextResponse.json({ error: "Template introuvable" }, { status: 404 });
  }

  return NextResponse.json(template);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  if (!hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = updateTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) updates[key] = value;
  }

  const [updated] = await db
    .update(templates)
    .set(updates)
    .where(eq(templates.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Template introuvable" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  if (!hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });
  }

  const { id } = await params;
  const [deleted] = await db
    .delete(templates)
    .where(eq(templates.id, id))
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Template introuvable" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

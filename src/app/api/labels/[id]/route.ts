import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { labels } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";
import { z } from "zod";

const updateLabelSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide (format attendu : #RRGGBB)").optional(),
});

// PATCH /api/labels/[id] — modifier un label global (admin uniquement)
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
  const parsed = updateLabelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.color !== undefined) updates.color = parsed.data.color;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Aucune modification fournie" }, { status: 400 });
  }

  const [updated] = await db
    .update(labels)
    .set(updates)
    .where(and(eq(labels.id, id), eq(labels.isGlobal, true)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Label introuvable" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

// DELETE /api/labels/[id] — supprimer un label global (admin uniquement)
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
    .delete(labels)
    .where(and(eq(labels.id, id), eq(labels.isGlobal, true)))
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Label introuvable" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

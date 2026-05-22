import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { spaces, documents, spacePermissions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";
import type { UserRole } from "@/types";
import { logActivity } from "@/lib/activity";
import { z } from "zod";

async function getSpaceBySlug(slug: string) {
  const [space] = await db
    .select()
    .from(spaces)
    .where(eq(spaces.slug, slug))
    .limit(1);
  return space || null;
}

async function canManageSpace(userId: string, globalRole: UserRole, spaceId: string, ownerUserId: string | null) {
  if (hasGlobalRole(globalRole, "admin")) return true;
  if (ownerUserId === userId) return true;

  const [perm] = await db
    .select()
    .from(spacePermissions)
    .where(
      and(
        eq(spacePermissions.spaceId, spaceId),
        eq(spacePermissions.userId, userId),
        eq(spacePermissions.level, "admin")
      )
    )
    .limit(1);

  return !!perm;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { slug } = await params;
  const space = await getSpaceBySlug(slug);

  if (!space) {
    return NextResponse.json({ error: "Espace introuvable" }, { status: 404 });
  }

  return NextResponse.json(space);
}

const updateSpaceSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  icon: z.string().max(50).optional(),
  classification: z.enum(["public", "internal", "confidential", "secret"]).optional(),
  appearancePreset: z.record(z.string(), z.unknown()).nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { slug } = await params;
  const space = await getSpaceBySlug(slug);

  if (!space) {
    return NextResponse.json({ error: "Espace introuvable" }, { status: 404 });
  }

  const canManage = await canManageSpace(user.id, user.globalRole, space.id, space.ownerUserId);
  if (!canManage) {
    return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = updateSpaceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.icon !== undefined) updates.icon = parsed.data.icon;
  if (parsed.data.classification !== undefined) updates.classification = parsed.data.classification;
  if (parsed.data.appearancePreset !== undefined) updates.appearancePreset = parsed.data.appearancePreset;

  const [updated] = await db
    .update(spaces)
    .set(updates)
    .where(eq(spaces.id, space.id))
    .returning();

  logActivity({
    userId: user.id,
    action: "update",
    entityType: "space",
    entityId: space.id,
    metadata: { name: updated.name },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { slug } = await params;
  const space = await getSpaceBySlug(slug);

  if (!space) {
    return NextResponse.json({ error: "Espace introuvable" }, { status: 404 });
  }

  const canManage = await canManageSpace(user.id, user.globalRole, space.id, space.ownerUserId);
  if (!canManage) {
    return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
  }

  // Supprimer les documents liés (cascade en BDD), puis l'espace
  await db.delete(documents).where(eq(documents.spaceId, space.id));
  await db.delete(spaces).where(eq(spaces.id, space.id));

  logActivity({
    userId: user.id,
    action: "delete",
    entityType: "space",
    entityId: space.id,
    metadata: { name: space.name },
  });

  return NextResponse.json({ success: true });
}

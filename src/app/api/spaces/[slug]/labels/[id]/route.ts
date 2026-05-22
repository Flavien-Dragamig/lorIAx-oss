import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { labels, spaces, spacePermissions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { canAdminSpace } from "@/lib/auth/rbac";
import type { PermissionLevel } from "@/types";

async function getSpaceBySlug(slug: string) {
  const [space] = await db
    .select()
    .from(spaces)
    .where(eq(spaces.slug, slug))
    .limit(1);
  return space || null;
}

async function getSpacePermissionLevel(userId: string, spaceId: string): Promise<PermissionLevel | null> {
  const [perm] = await db
    .select({ level: spacePermissions.level })
    .from(spacePermissions)
    .where(
      and(
        eq(spacePermissions.spaceId, spaceId),
        eq(spacePermissions.userId, userId)
      )
    )
    .limit(1);
  return (perm?.level as PermissionLevel) || null;
}

// DELETE /api/spaces/[slug]/labels/[id] — supprimer un label d'espace
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { slug, id } = await params;
  const space = await getSpaceBySlug(slug);
  if (!space) return NextResponse.json({ error: "Espace introuvable" }, { status: 404 });

  const spacePermission = await getSpacePermissionLevel(user.id, space.id);
  if (!canAdminSpace(user.globalRole, spacePermission)) {
    return NextResponse.json({ error: "Droits insuffisants pour gérer les labels de cet espace" }, { status: 403 });
  }

  // Sécurité : vérifier que le label appartient bien à cet espace (pas un label global)
  const [deleted] = await db
    .delete(labels)
    .where(
      and(
        eq(labels.id, id),
        eq(labels.spaceId, space.id),
        eq(labels.isGlobal, false)
      )
    )
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Label introuvable dans cet espace" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

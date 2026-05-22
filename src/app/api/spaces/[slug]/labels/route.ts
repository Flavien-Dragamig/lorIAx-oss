import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { labels, spaces, spacePermissions } from "@/lib/db/schema";
import { eq, or, and } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { canAdminSpace } from "@/lib/auth/rbac";
import type { PermissionLevel } from "@/types";
import { z } from "zod";

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

const createSpaceLabelSchema = z.object({
  name: z.string().min(1).max(64),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide (format attendu : #RRGGBB)"),
});

// GET /api/spaces/[slug]/labels — labels globaux + labels de l'espace (fusionnés)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { slug } = await params;
  const space = await getSpaceBySlug(slug);
  if (!space) return NextResponse.json({ error: "Espace introuvable" }, { status: 404 });

  const result = await db
    .select()
    .from(labels)
    .where(
      or(
        eq(labels.isGlobal, true),
        eq(labels.spaceId, space.id)
      )
    )
    .orderBy(labels.name);

  return NextResponse.json(result);
}

// POST /api/spaces/[slug]/labels — créer un label dans l'espace
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { slug } = await params;
  const space = await getSpaceBySlug(slug);
  if (!space) return NextResponse.json({ error: "Espace introuvable" }, { status: 404 });

  const spacePermission = await getSpacePermissionLevel(user.id, space.id);
  if (!canAdminSpace(user.globalRole, spacePermission)) {
    return NextResponse.json({ error: "Droits insuffisants pour gérer les labels de cet espace" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createSpaceLabelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const [label] = await db
    .insert(labels)
    .values({
      name: parsed.data.name,
      color: parsed.data.color,
      spaceId: space.id,
      isGlobal: false,
      createdBy: user.id,
    })
    .returning();

  return NextResponse.json(label, { status: 201 });
}

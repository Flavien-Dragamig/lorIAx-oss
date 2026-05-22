import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { spaces, spacePermissions, users, teams, teamMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";
import type { UserRole } from "@/types";
import { logActivity } from "@/lib/activity";
import { createNotification, createNotifications } from "@/lib/notifications";
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

// GET — Lister les membres d'un espace
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { slug } = await params;
  const space = await getSpaceBySlug(slug);
  if (!space) return NextResponse.json({ error: "Espace introuvable" }, { status: 404 });

  // Vérifier que l'utilisateur a accès à l'espace (au minimum viewer ou owner)
  if (!hasGlobalRole(user.globalRole, "admin") && space.ownerUserId !== user.id) {
    const [perm] = await db
      .select()
      .from(spacePermissions)
      .where(
        and(
          eq(spacePermissions.spaceId, space.id),
          eq(spacePermissions.userId, user.id)
        )
      )
      .limit(1);
    if (!perm) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // Récupérer les permissions avec les infos utilisateur/équipe
  const permissions = await db
    .select({
      id: spacePermissions.id,
      level: spacePermissions.level,
      createdAt: spacePermissions.createdAt,
      userId: spacePermissions.userId,
      teamId: spacePermissions.teamId,
      userName: users.name,
      userEmail: users.email,
      userAvatar: users.avatarUrl,
      teamName: teams.name,
    })
    .from(spacePermissions)
    .leftJoin(users, eq(spacePermissions.userId, users.id))
    .leftJoin(teams, eq(spacePermissions.teamId, teams.id))
    .where(eq(spacePermissions.spaceId, space.id));

  // Récupérer le propriétaire
  let owner = null;
  if (space.ownerUserId) {
    const [ownerUser] = await db
      .select({ id: users.id, name: users.name, email: users.email, avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, space.ownerUserId))
      .limit(1);
    if (ownerUser) owner = { ...ownerUser, role: "owner" as const };
  }

  return NextResponse.json({ owner, members: permissions });
}

const addMemberSchema = z.object({
  email: z.string().email().optional(),
  userId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
  level: z.enum(["viewer", "editor", "admin"]).default("viewer"),
}).refine(
  (data) => data.email || data.userId || data.teamId,
  { message: "email, userId ou teamId requis" }
);

// POST — Ajouter un membre à l'espace
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { slug } = await params;
  const space = await getSpaceBySlug(slug);
  if (!space) return NextResponse.json({ error: "Espace introuvable" }, { status: 404 });

  const canManage = await canManageSpace(user.id, user.globalRole, space.id, space.ownerUserId);
  if (!canManage) return NextResponse.json({ error: "Permission refusée" }, { status: 403 });

  const body = await request.json();
  const parsed = addMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { email, userId, teamId, level } = parsed.data;

  // Résoudre l'utilisateur par email si nécessaire
  let targetUserId = userId;
  if (email && !userId) {
    const [found] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!found) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }
    targetUserId = found.id;
  }

  // Vérifier s'il existe déjà une permission
  if (targetUserId) {
    const [existing] = await db
      .select()
      .from(spacePermissions)
      .where(
        and(
          eq(spacePermissions.spaceId, space.id),
          eq(spacePermissions.userId, targetUserId)
        )
      )
      .limit(1);

    if (existing) {
      return NextResponse.json({ error: "Ce membre a déjà accès à cet espace" }, { status: 409 });
    }
  }

  if (teamId) {
    const [existing] = await db
      .select()
      .from(spacePermissions)
      .where(
        and(
          eq(spacePermissions.spaceId, space.id),
          eq(spacePermissions.teamId, teamId)
        )
      )
      .limit(1);

    if (existing) {
      return NextResponse.json({ error: "Cette équipe a déjà accès à cet espace" }, { status: 409 });
    }
  }

  const [permission] = await db
    .insert(spacePermissions)
    .values({
      spaceId: space.id,
      userId: targetUserId || null,
      teamId: teamId || null,
      level,
    })
    .returning();

  logActivity({
    userId: user.id,
    action: "add_member",
    entityType: "space",
    entityId: space.id,
    metadata: { targetUserId, teamId, level },
  });

  // Notification : notifier l'utilisateur ajouté (ou les membres de l'équipe)
  if (targetUserId) {
    await createNotification({
      userId: targetUserId,
      type: "share",
      title: `${user.name} vous a ajouté à l'espace « ${space.name} »`,
      message: `Rôle : ${level}`,
      actorId: user.id,
    });
  } else if (teamId) {
    // Notifier tous les membres de l'équipe
    const members = await db
      .select({ userId: teamMembers.userId })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, teamId));

    await createNotifications(
      members.map((m) => m.userId),
      {
        type: "share",
        title: `Votre équipe a été ajoutée à l'espace « ${space.name} »`,
        message: `Rôle : ${level}`,
        actorId: user.id,
      }
    );
  }

  return NextResponse.json(permission, { status: 201 });
}

const updateMemberSchema = z.object({
  permissionId: z.string().uuid(),
  level: z.enum(["viewer", "editor", "admin"]),
});

// PATCH — Modifier le niveau de permission d'un membre
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { slug } = await params;
  const space = await getSpaceBySlug(slug);
  if (!space) return NextResponse.json({ error: "Espace introuvable" }, { status: 404 });

  const canManage = await canManageSpace(user.id, user.globalRole, space.id, space.ownerUserId);
  if (!canManage) return NextResponse.json({ error: "Permission refusée" }, { status: 403 });

  const body = await request.json();
  const parsed = updateMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const [updated] = await db
    .update(spacePermissions)
    .set({ level: parsed.data.level })
    .where(
      and(
        eq(spacePermissions.id, parsed.data.permissionId),
        eq(spacePermissions.spaceId, space.id)
      )
    )
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Permission introuvable" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

// DELETE — Retirer un membre de l'espace
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { slug } = await params;
  const space = await getSpaceBySlug(slug);
  if (!space) return NextResponse.json({ error: "Espace introuvable" }, { status: 404 });

  const canManage = await canManageSpace(user.id, user.globalRole, space.id, space.ownerUserId);
  if (!canManage) return NextResponse.json({ error: "Permission refusée" }, { status: 403 });

  const permissionId = request.nextUrl.searchParams.get("permissionId");
  if (!permissionId) {
    return NextResponse.json({ error: "permissionId requis" }, { status: 400 });
  }

  await db
    .delete(spacePermissions)
    .where(
      and(
        eq(spacePermissions.id, permissionId),
        eq(spacePermissions.spaceId, space.id)
      )
    );

  logActivity({
    userId: user.id,
    action: "remove_member",
    entityType: "space",
    entityId: space.id,
    metadata: { permissionId },
  });

  return NextResponse.json({ success: true });
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { spaces, spacePermissions, teamMembers, users } from "@/lib/db/schema";
import { eq, or, inArray, and } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";
import slugify from "slugify";
import { initRepository } from "@/lib/git/repository";
import { logActivity } from "@/lib/activity";
import { z } from "zod";
import { getLicenseFromDB } from "@/lib/license/validate";
import { checkSpacesLimit } from "@/lib/license/metering";
import { headers } from "next/headers";
import { getOrgId, getOrgSlugFromHeaders } from "@/lib/org/get-org-id";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json([], { status: 401 });

  const orgSlug = await getOrgSlugFromHeaders(headers);
  const orgId = await getOrgId(orgSlug);

  // Helper : enrichir les espaces avec l'avatar du propriétaire
  async function withOwnerAvatars(spaceList: (typeof spaces.$inferSelect)[]) {
    const ownerIds = [...new Set(spaceList.filter((s) => s.ownerUserId).map((s) => s.ownerUserId!))];
    if (ownerIds.length === 0) return spaceList.map((s) => ({ ...s, ownerAvatarUrl: null }));

    const owners = await db
      .select({ id: users.id, avatarUrl: users.avatarUrl, email: users.email })
      .from(users)
      .where(inArray(users.id, ownerIds));

    const ownerMap = new Map(owners.map((o) => [o.id, o]));
    return spaceList.map((s) => {
      const owner = s.ownerUserId ? ownerMap.get(s.ownerUserId) : null;
      return {
        ...s,
        ownerAvatarUrl: owner?.avatarUrl ?? null,
        ownerEmail: owner?.email ?? null,
      };
    });
  }

  // Admins voient tous les espaces de l'organisation
  if (hasGlobalRole(user.globalRole, "admin")) {
    const allSpaces = await db.select().from(spaces)
      .where(eq(spaces.organizationId, orgId))
      .orderBy(spaces.name);
    return NextResponse.json(await withOwnerAvatars(allSpaces));
  }

  // Trouver les equipes de l'utilisateur
  const userTeams = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, user.id));

  const teamIds = userTeams.map((t) => t.teamId);

  // Espaces accessibles : perso + permissions directes + permissions equipe
  const perms = await db
    .select({ spaceId: spacePermissions.spaceId })
    .from(spacePermissions)
    .where(
      or(
        eq(spacePermissions.userId, user.id),
        teamIds.length > 0
          ? inArray(spacePermissions.teamId, teamIds)
          : undefined
      )
    );

  const permSpaceIds = perms.map((p) => p.spaceId);

  // Espaces accessibles (hors secret sauf si membre/admin), filtrés par org
  const allAccessible = await db
    .select()
    .from(spaces)
    .where(
      and(
        eq(spaces.organizationId, orgId),
        or(
          eq(spaces.ownerUserId, user.id),
          eq(spaces.type, "organization"),
          permSpaceIds.length > 0
            ? inArray(spaces.id, permSpaceIds)
            : undefined,
          teamIds.length > 0
            ? inArray(spaces.ownerTeamId, teamIds)
            : undefined
        )
      )
    )
    .orderBy(spaces.name);

  // Filtrer les espaces "secret" pour les non-admins sans permission d'espace
  const permSpaceIdSet = new Set(permSpaceIds);
  const accessibleSpaces = allAccessible.filter((s) => {
    if (s.classification !== "secret") return true;
    if (s.ownerUserId === user.id) return true;
    return permSpaceIdSet.has(s.id);
  });

  return NextResponse.json(await withOwnerAvatars(accessibleSpaces));
}

const createSpaceSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["personal", "team", "organization"]),
  description: z.string().optional(),
  icon: z.string().max(50).optional(),
  ownerTeamId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const orgSlug = await getOrgSlugFromHeaders(headers);
  const orgId = await getOrgId(orgSlug);

  const body = await request.json();
  const parsed = createSpaceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { name, type, description, icon, ownerTeamId } = parsed.data;

  // Seuls les admins peuvent creer des espaces organisation
  if (type === "organization" && !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
  }

  // Vérifier le quota espaces de la licence (hors espaces personnels)
  if (type !== "personal") {
    const license = await getLicenseFromDB();
    const spacesStatus = await checkSpacesLimit(license);
    if (spacesStatus.exceeded) {
      return NextResponse.json(
        { error: `Quota d'espaces atteint (${spacesStatus.current}/${spacesStatus.max}). Mettez à niveau votre licence.` },
        { status: 403 }
      );
    }
  }

  const slug = slugify(name, { lower: true, strict: true });
  const gitRepoPath = `${type}/${slug}-${Date.now()}`;

  const [space] = await db
    .insert(spaces)
    .values({
      name,
      slug,
      type,
      description,
      icon,
      ownerUserId: type !== "team" ? user.id : undefined,
      ownerTeamId: type === "team" ? ownerTeamId : undefined,
      gitRepoPath,
      organizationId: orgId,
    })
    .returning();

  await initRepository(gitRepoPath);

  logActivity({
    userId: user.id,
    action: "create",
    entityType: "space",
    entityId: space.id,
    metadata: { name, type },
  });

  return NextResponse.json(space, { status: 201 });
}

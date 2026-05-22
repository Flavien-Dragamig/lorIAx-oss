// src/app/api/setup/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, spaces, teams, teamMembers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import slugify from "slugify";
import { initRepository } from "@/lib/git/repository";
import { ensurePersonalCalendar } from "@/lib/calendar/auto-provision";
import { guardSetupNotCompleted } from "@/lib/setup/guards";
import logger from "@/lib/logger";
import { getDefaultOrgId } from "@/lib/org/get-org-id";

interface UserPayload {
  name: string;
  email: string;
  role: string;
  password: string;
  team?: string;
}

const VALID_ROLES = ["super_admin", "admin", "editor", "viewer"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const blocked = await guardSetupNotCompleted();
  if (blocked) return blocked;

  try {
    const body = await request.json();
    const { users: userList } = body as { users: UserPayload[] };

    if (!Array.isArray(userList) || userList.length === 0) {
      return NextResponse.json(
        { error: "La liste des utilisateurs est vide" },
        { status: 400 }
      );
    }

    // Validate all users before creating any
    const errors: string[] = [];
    const seenEmails = new Set<string>();

    for (let i = 0; i < userList.length; i++) {
      const u = userList[i];
      const line = i + 1;

      if (!u.name?.trim()) {
        errors.push(`Utilisateur ${line} : nom manquant`);
      }
      if (!u.email || !EMAIL_RE.test(u.email)) {
        errors.push(`Utilisateur ${line} : email invalide`);
      }
      if (!u.password || u.password.length < 12) {
        errors.push(`Utilisateur ${line} : mot de passe trop court (12 car. min.)`);
      }
      if (u.role && !VALID_ROLES.includes(u.role)) {
        errors.push(`Utilisateur ${line} : rôle invalide « ${u.role} »`);
      }

      const email = u.email?.toLowerCase().trim();
      if (seenEmails.has(email)) {
        errors.push(`Utilisateur ${line} : email en doublon (${email})`);
      }
      seenEmails.add(email);
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join("\n"), errors }, { status: 400 });
    }

    // Check for existing emails in database
    for (const u of userList) {
      const email = u.email.toLowerCase().trim();
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existing) {
        errors.push(`Un compte avec l'email ${email} existe déjà`);
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join("\n"), errors }, { status: 409 });
    }

    // Récupérer l'org par défaut (setup mono-tenant : une seule organisation)
    const orgId = await getDefaultOrgId();

    // Cache for teams (name -> id)
    const teamCache = new Map<string, string>();
    const createdUsers: Array<{ id: string; email: string; name: string }> = [];

    for (const u of userList) {
      const email = u.email.toLowerCase().trim();
      const name = u.name.trim();
      const role = (u.role || "editor") as "super_admin" | "admin" | "editor" | "viewer";
      const passwordHash = await bcrypt.hash(u.password, 10);

      // Create user
      const [newUser] = await db
        .insert(users)
        .values({
          name,
          email,
          passwordHash,
          globalRole: role,
        })
        .returning({ id: users.id, email: users.email, name: users.name });

      // Create personal space
      const baseSlug = slugify(name, { lower: true, strict: true });
      const gitRepoPath = `personal/${newUser.id}`;

      await db.insert(spaces).values({
        name: `Espace de ${name}`,
        slug: `personal-${baseSlug}-${newUser.id.slice(0, 8)}`,
        type: "personal",
        ownerUserId: newUser.id,
        gitRepoPath,
        organizationId: orgId,
      });

      // Init git repo
      await initRepository(gitRepoPath).catch((err) =>
        logger.error({ err, userId: newUser.id }, "[setup/users] Erreur init repo git")
      );

      // Create personal calendar
      await ensurePersonalCalendar(newUser.id, name).catch((err) =>
        logger.error({ err, userId: newUser.id }, "[setup/users] Erreur création calendrier")
      );

      // Handle team association
      if (u.team?.trim()) {
        const teamName = u.team.trim();
        let teamId = teamCache.get(teamName);

        if (!teamId) {
          // Check if team exists
          const [existingTeam] = await db
            .select({ id: teams.id })
            .from(teams)
            .where(eq(teams.name, teamName))
            .limit(1);

          if (existingTeam) {
            teamId = existingTeam.id;
          } else {
            // Create team
            const [newTeam] = await db
              .insert(teams)
              .values({
                name: teamName,
                createdBy: newUser.id,
                organizationId: orgId,
              })
              .returning({ id: teams.id });
            teamId = newTeam.id;
          }
          teamCache.set(teamName, teamId);
        }

        // Associate user to team
        await db
          .insert(teamMembers)
          .values({
            teamId,
            userId: newUser.id,
            role: role === "super_admin" || role === "admin" ? "admin" : "member",
          })
          .onConflictDoNothing();
      }

      createdUsers.push(newUser);
    }

    logger.info(
      { count: createdUsers.length },
      "[setup/users] Utilisateurs créés via le wizard"
    );

    return NextResponse.json({
      success: true,
      created: createdUsers,
    });
  } catch (error) {
    logger.error({ err: error }, "[setup/users] Erreur création utilisateurs");
    return NextResponse.json(
      { error: "Erreur serveur lors de la création des utilisateurs" },
      { status: 500 }
    );
  }
}

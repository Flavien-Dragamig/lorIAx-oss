import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, spaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";
import bcrypt from "bcryptjs";
import slugify from "slugify";
import { sendEmail } from "@/lib/email/send";
import { accountCreatedEmail } from "@/lib/email/templates/account-created";
import { initRepository } from "@/lib/git/repository";
import { ensurePersonalCalendar } from "@/lib/calendar/auto-provision";
import { getLicenseFromDB } from "@/lib/license/validate";
import { checkUsersLimit } from "@/lib/license/metering";
import logger from "@/lib/logger";
import { getDefaultOrgId } from "@/lib/org/get-org-id";

export async function GET() {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      globalRole: users.globalRole,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .orderBy(users.name);

  return NextResponse.json(allUsers);
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, email, password, globalRole, sendWelcomeEmail } = body;

    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json({ error: "Nom, email et mot de passe requis" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Le mot de passe doit faire au moins 8 caractères" }, { status: 400 });
    }

    const validRoles = ["viewer", "editor", "facility_manager", "admin", "super_admin"] as const;
    type ValidRole = typeof validRoles[number];
    const requestedRole = (validRoles as readonly string[]).includes(globalRole) ? globalRole : "editor";

    if (requestedRole === "super_admin" && !hasGlobalRole(user.globalRole, "super_admin")) {
      return NextResponse.json({ error: "Seul un super admin peut créer un super admin" }, { status: 403 });
    }

    const role: ValidRole = requestedRole;
    const normalizedEmail = email.toLowerCase().trim();

    // Vérifier le quota utilisateurs de la licence
    const license = await getLicenseFromDB();
    const usersStatus = await checkUsersLimit(license);
    if (usersStatus.exceeded) {
      return NextResponse.json(
        { error: `Quota d'utilisateurs atteint (${usersStatus.current}/${usersStatus.max}). Mettez à niveau votre licence.` },
        { status: 403 }
      );
    }

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existing) {
      return NextResponse.json({ error: "Un compte avec cet email existe déjà" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [created] = await db
      .insert(users)
      .values({ name: name.trim(), email: normalizedEmail, passwordHash, globalRole: role })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        globalRole: users.globalRole,
        createdAt: users.createdAt,
      });

    // Créer l'espace personnel (comme lors de l'inscription)
    const slug = slugify(name.trim(), { lower: true, strict: true });
    const gitRepoPath = `personal/${created.id}`;
    const orgId = await getDefaultOrgId();
    await db.insert(spaces).values({
      name: `Espace de ${name.trim()}`,
      slug: `personal-${slug}`,
      type: "personal",
      ownerUserId: created.id,
      gitRepoPath,
      organizationId: orgId,
    });
    await initRepository(gitRepoPath);

    // Créer le calendrier personnel
    await ensurePersonalCalendar(created.id, name.trim()).catch((err) =>
      logger.error({ err }, "[admin/users] Erreur création calendrier personnel")
    );

    let emailSent = false;
    if (sendWelcomeEmail) {
      try {
        const appUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        const template = accountCreatedEmail({
          name: created.name,
          email: created.email,
          password,
          loginUrl: `${appUrl}/login`,
        });
        const result = await sendEmail({ to: created.email, ...template });
        emailSent = result.success;
      } catch {
        emailSent = false;
      }
    }

    return NextResponse.json({ user: created, emailSent }, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, "[admin/users] Erreur création utilisateur");
    return NextResponse.json({ error: "Erreur serveur lors de la création" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json();
  const { id, globalRole, name } = body;

  if (!id) {
    return NextResponse.json({ error: "ID requis" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (globalRole) {
    const validRoles = ["viewer", "editor", "facility_manager", "admin", "super_admin"] as const;
    if (!(validRoles as readonly string[]).includes(globalRole)) {
      return NextResponse.json({ error: "Rôle invalide" }, { status: 400 });
    }
    // Seul un super_admin peut accorder le rôle super_admin
    if (globalRole === "super_admin" && !hasGlobalRole(user.globalRole, "super_admin")) {
      return NextResponse.json(
        { error: "Seul un super admin peut accorder le rôle super admin" },
        { status: 403 }
      );
    }
    updates.globalRole = globalRole;
  }

  if (name) updates.name = name;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Aucune modification" }, { status: 400 });
  }

  await db.update(users).set(updates).where(eq(users.id, id));

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "super_admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "ID requis" }, { status: 400 });
  }

  if (id === user.id) {
    return NextResponse.json(
      { error: "Impossible de supprimer votre propre compte" },
      { status: 400 }
    );
  }

  await db.delete(users).where(eq(users.id, id));

  return NextResponse.json({ success: true });
}

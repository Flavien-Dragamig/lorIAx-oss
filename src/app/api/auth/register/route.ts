import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, spaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import slugify from "slugify";
import { initRepository } from "@/lib/git/repository";
import { checkRateLimit, RATE_LIMITS, getClientIp } from "@/lib/rate-limit";
import { z } from "zod";
import logger from "@/lib/logger";
import { ensurePersonalCalendar } from "@/lib/calendar/auto-provision";
import { getLicenseFromDB } from "@/lib/license/validate";
import { checkUsersLimit } from "@/lib/license/metering";
import { getDefaultOrgId } from "@/lib/org/get-org-id";

const registerSchema = z.object({
  name: z.string().min(2, "Le nom doit faire au moins 2 caracteres"),
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "Le mot de passe doit faire au moins 8 caracteres"),
});

export async function POST(request: Request) {
  // Rate limiting
  const ip = getClientIp(request);
  const rateLimitResult = checkRateLimit(`register:${ip}`, RATE_LIMITS.auth);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez plus tard." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, password } = parsed.data;
    const email = parsed.data.email.toLowerCase().trim();

    // Vérifier le quota utilisateurs de la licence
    const license = await getLicenseFromDB();
    const usersStatus = await checkUsersLimit(license);
    if (usersStatus.exceeded) {
      return NextResponse.json(
        { error: `Quota d'utilisateurs atteint (${usersStatus.current}/${usersStatus.max}). Mettez à niveau votre licence.` },
        { status: 403 }
      );
    }

    // Verifier si l'email existe deja
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: "Un compte avec cet email existe deja" },
        { status: 409 }
      );
    }

    // Résoudre l'organisation d'accueil AVANT toute écriture : `/register` rejoint
    // une instance déjà provisionnée. Sur une instance vierge, aucune org n'existe
    // — il faut passer par `/register-org`. On vérifie ici pour ne pas insérer un
    // utilisateur orphelin (la route n'est pas transactionnelle) ni renvoyer une 500.
    let orgId: string;
    try {
      orgId = await getDefaultOrgId();
    } catch {
      return NextResponse.json(
        {
          error:
            "Aucune organisation n'existe encore sur cette instance. Créez-en une d'abord.",
          needsOrg: true,
        },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Creer l'utilisateur
    const [user] = await db
      .insert(users)
      .values({ name, email, passwordHash })
      .returning();

    // Creer l'espace personnel
    const slug = slugify(name, { lower: true, strict: true });
    const gitRepoPath = `personal/${user.id}`;

    await db.insert(spaces).values({
      name: `Espace de ${name}`,
      slug: `personal-${slug}`,
      type: "personal",
      ownerUserId: user.id,
      gitRepoPath,
      organizationId: orgId,
    });

    // Initialiser le repo git de l'espace
    await initRepository(gitRepoPath);

    // Créer le calendrier personnel par défaut
    await ensurePersonalCalendar(user.id, name).catch((err) =>
      logger.error({ err }, "[register] Erreur création calendrier personnel")
    );

    return NextResponse.json(
      { message: "Compte cree avec succes", userId: user.id },
      { status: 201 }
    );
  } catch (error) {
    logger.error({ err: error }, "[register] Erreur inscription utilisateur");
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

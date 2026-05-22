import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, spaces } from "@/lib/db/schema";
import { organizations, organizationMembers } from "@/lib/db/schema-org";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { isValidSlug, isReservedSlug } from "@/lib/billing/slug-validation";
import logger from "@/lib/logger";
import { initRepository } from "@/lib/git/repository";

const registerOrgSchema = z.object({
  userName: z.string().min(2, "Le nom doit faire au moins 2 caractères"),
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "Le mot de passe doit faire au moins 8 caractères"),
  orgName: z.string().min(2, "Le nom de l'organisation doit faire au moins 2 caractères"),
  orgSlug: z.string()
    .transform((s) => s.toLowerCase().trim())
    .refine(isValidSlug, "Format de slug invalide"),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const parsed = registerOrgSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { userName, password, orgName } = parsed.data;
  const email = parsed.data.email.toLowerCase().trim();
  const orgSlug = parsed.data.orgSlug;

  if (isReservedSlug(orgSlug)) {
    return NextResponse.json({ error: "Cet identifiant d'organisation est déjà utilisé" }, { status: 409 });
  }

  // Vérifier unicité slug
  const [existingOrg] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);
  if (existingOrg) {
    return NextResponse.json({ error: "Cet identifiant d'organisation est déjà utilisé" }, { status: 409 });
  }

  // Vérifier unicité email
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existingUser) {
    return NextResponse.json({ error: "Un compte avec cet email existe déjà" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Transaction atomique
  let result: { user: { id: string; email: string; name: string }; org: { id: string }; gitRepoPath: string };
  try {
  result = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ name: userName, email, passwordHash })
      .returning({ id: users.id, email: users.email, name: users.name });

    const [org] = await tx
      .insert(organizations)
      .values({
        slug: orgSlug,
        name: orgName,
        plan: "free",
        maxUsers: 3,
        maxSpaces: 3,
        isActive: true,
      })
      .returning({ id: organizations.id });

    await tx.insert(organizationMembers).values({
      organizationId: org.id,
      userId: user.id,
      role: "owner",
    });

    const spaceSlug = `${orgSlug}-general`;
    const gitRepoPath = `org/${org.id}/general`;

    await tx.insert(spaces).values({
      name: "Général",
      slug: spaceSlug,
      type: "organization",
      gitRepoPath,
      organizationId: org.id,
    });

    return { user, org, gitRepoPath };
  });
  } catch (err: unknown) {
    // Violation de contrainte unique (slug ou email déjà pris — race condition)
    const message = err instanceof Error ? err.message : "";
    if (message.includes("unique") || message.includes("duplicate")) {
      return NextResponse.json(
        { error: "Ce sous-domaine ou cet email est déjà utilisé" },
        { status: 409 }
      );
    }
    throw err;
  }

  // Initialiser le dépôt git hors transaction (side-effect filesystem)
  try {
    await initRepository(result.gitRepoPath);
  } catch (err) {
    logger.warn({ err, orgSlug }, "[register-org] Échec initRepository — non bloquant");
  }

  logger.info({ orgSlug, email }, "[register-org] Nouvelle organisation créée");

  return NextResponse.json(
    { message: "Organisation créée", orgSlug },
    { status: 201 }
  );
}

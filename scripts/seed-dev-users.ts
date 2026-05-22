/**
 * Seed des utilisateurs de dev (admin + user)
 * Usage : npx tsx scripts/seed-dev-users.ts
 */

import { db } from "../src/lib/db";
import { users, spaces, spacePermissions } from "../src/lib/db/schema";
import { organizations, organizationMembers } from "../src/lib/db/schema-org";
import { eq, and, isNull } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { initRepository } from "../src/lib/git/repository";


// UUIDs fixes pour que db:fresh ne casse pas les sessions JWT en cours
const DEV_USERS = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    email: "admin@loriax.dev",
    name: "Admin LorIAx",
    password: "admin123",
    globalRole: "super_admin" as const,
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    email: "user@loriax.dev",
    name: "Utilisateur LorIAx",
    password: "user123",
    globalRole: "editor" as const,
  },
];

async function seed() {
  if (process.env.NODE_ENV === "production") {
    console.error("❌ Le seed de développement ne peut pas être exécuté en production.");
    process.exit(1);
  }

  console.log("Seeding dev users...\n");

  // Créer/upsert l'organisation par défaut
  const [defaultOrg] = await db
    .insert(organizations)
    .values({
      slug: "default",
      name: "LorIAx",
      plan: "community",
      maxUsers: 999,
      maxSpaces: 9999,
    })
    .onConflictDoUpdate({
      target: organizations.slug,
      set: { name: "LorIAx" },
    })
    .returning({ id: organizations.id });
  const orgId = defaultOrg.id;
  console.log(`  ✓ Organisation "LorIAx" (${orgId})\n`);

  for (const u of DEV_USERS) {
    // Verifier si l'utilisateur existe deja
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, u.email))
      .limit(1);

    if (existing.length > 0) {
      // Ensure git repos exist for existing users' spaces
      const existingSpaces = await db
        .select({ gitRepoPath: spaces.gitRepoPath })
        .from(spaces)
        .where(eq(spaces.ownerUserId, existing[0].id));
      for (const s of existingSpaces) {
        try {
          await initRepository(s.gitRepoPath);
          console.log(`  ✓ Repo init: ${s.gitRepoPath}`);
        } catch {
          console.log(`  ⏭  Repo deja init: ${s.gitRepoPath}`);
        }
      }
      // Upsert appartenance à l'organisation (onConflictDoNothing pour ne pas changer le rôle)
      await db.insert(organizationMembers).values({
        organizationId: orgId,
        userId: existing[0].id,
        role: u.globalRole === "super_admin" ? "owner" : "member",
      }).onConflictDoNothing();

      // Mettre à jour les espaces sans organizationId
      await db.update(spaces)
        .set({ organizationId: orgId })
        .where(and(eq(spaces.ownerUserId, existing[0].id), isNull(spaces.organizationId)));

      console.log(`  ⏭  ${u.email} existe deja`);
      continue;
    }

    const passwordHash = await bcrypt.hash(u.password, 12);
    const userId = u.id;

    await db.insert(users).values({
      id: userId,
      email: u.email,
      name: u.name,
      passwordHash,
      globalRole: u.globalRole,
    });

    // Creer un espace personnel
    const spaceSlug = u.email.split("@")[0].replace(/[^a-z0-9]/g, "-");
    const spaceId = randomUUID();

    await db.insert(spaces).values({
      id: spaceId,
      name: `Espace de ${u.name}`,
      slug: `perso-${spaceSlug}`,
      type: "personal",
      ownerUserId: userId,
      gitRepoPath: `perso-${spaceSlug}`,
      organizationId: orgId,
    });

    // Initialiser le repo git de l'espace
    await initRepository(`perso-${spaceSlug}`);

    await db.insert(spacePermissions).values({
      spaceId,
      userId,
      level: "admin",
    });

    // Lier l'utilisateur à l'organisation
    await db.insert(organizationMembers).values({
      organizationId: orgId,
      userId,
      role: u.globalRole === "super_admin" ? "owner" : "member",
    }).onConflictDoUpdate({
      target: [organizationMembers.organizationId, organizationMembers.userId],
      set: { role: u.globalRole === "super_admin" ? "owner" : "member" },
    });

    console.log(`  ✓ ${u.name} <${u.email}> (${u.globalRole}) — mdp: ${u.password}`);
  }

  console.log("\nDone!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Erreur seed:", err);
  process.exit(1);
});

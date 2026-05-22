import { db } from "@/lib/db";
import { users, spaces } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";
import slugify from "slugify";
import { initRepository } from "@/lib/git/repository";
import type { LdapUser } from "./ldap";
import { ensurePersonalCalendar } from "@/lib/calendar/auto-provision";
import { getDefaultOrgId } from "@/lib/org/get-org-id";

/**
 * Synchronize an LDAP user with the local database.
 * - If found by ldapDn or email: update name + ldapDn
 * - If not found: create user + personal space
 * Returns the local user record.
 */
export async function syncLdapUser(ldapUser: LdapUser) {
  // Try to find existing user by ldapDn or email
  const [existing] = await db
    .select()
    .from(users)
    .where(
      or(
        eq(users.ldapDn, ldapUser.dn),
        eq(users.email, ldapUser.email.toLowerCase())
      )
    )
    .limit(1);

  if (existing) {
    // Update ldapDn and name if changed
    if (existing.ldapDn !== ldapUser.dn || existing.name !== ldapUser.name) {
      await db
        .update(users)
        .set({
          ldapDn: ldapUser.dn,
          name: ldapUser.name,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing.id));
    }

    return {
      id: existing.id,
      email: existing.email,
      name: ldapUser.name,
      globalRole: existing.globalRole,
      avatarUrl: existing.avatarUrl,
    };
  }

  // Create new user (no password — LDAP-only)
  const email = ldapUser.email.toLowerCase().trim();

  const [newUser] = await db
    .insert(users)
    .values({
      email,
      name: ldapUser.name,
      passwordHash: null,
      ldapDn: ldapUser.dn,
    })
    .returning();

  // Create personal space
  const slug = slugify(ldapUser.name, { lower: true, strict: true });
  const gitRepoPath = `personal/${newUser.id}`;
  const orgId = await getDefaultOrgId();

  await db.insert(spaces).values({
    name: `Espace de ${ldapUser.name}`,
    slug: `personal-${slug}`,
    type: "personal",
    ownerUserId: newUser.id,
    gitRepoPath,
    organizationId: orgId,
  });

  await initRepository(gitRepoPath);

  // Créer le calendrier personnel par défaut
  await ensurePersonalCalendar(newUser.id, ldapUser.name).catch(() => {});

  return {
    id: newUser.id,
    email: newUser.email,
    name: newUser.name,
    globalRole: newUser.globalRole,
    avatarUrl: newUser.avatarUrl,
  };
}

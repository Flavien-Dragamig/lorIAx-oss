import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { asc } from "drizzle-orm";

async function fetchOrgId(slug: string): Promise<string> {
  const [org] = await db
    .select({ id: organizations.id, isActive: organizations.isActive })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  if (!org) throw new Error("Organisation introuvable");
  if (!org.isActive) throw new Error("Organisation désactivée");
  return org.id;
}

export const getOrgId = unstable_cache(fetchOrgId, ["org-id"], {
  revalidate: 60,
  tags: ["org"],
});

export async function getOrgSlugFromHeaders(
  headersFn: () => Promise<Headers> | Headers,
): Promise<string> {
  const h = await headersFn();
  return h.get("x-org-slug") ?? "default";
}

/**
 * Récupère l'ID de la première organisation active (utile pendant le wizard setup
 * ou dans les contextes sans session, ex. LDAP sync).
 * En mode mono-tenant, il n'y a qu'une seule organisation.
 */
export async function getDefaultOrgId(): Promise<string> {
  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.isActive, true))
    .orderBy(asc(organizations.createdAt))
    .limit(1);

  if (!org) throw new Error("Aucune organisation active trouvée");
  return org.id;
}

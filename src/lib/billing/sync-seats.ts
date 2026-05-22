import { db } from "@/lib/db";
import { organizationMembers, organizations } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { validateEnv } from "@/lib/env";

/**
 * Compte les membres d'une organisation et synchronise ce nombre de sièges
 * vers l'abonnement Stripe cloud (via loriax-license-manager).
 *
 * Non bloquant : toute erreur est journalisée sans interrompre l'appelant.
 * À invoquer après chaque ajout/retrait de membre d'une organisation.
 */
export async function syncOrgSeats(organizationId: string): Promise<void> {
  try {
    const [org] = await db
      .select({ slug: organizations.slug })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    if (!org) return;

    const [{ value: seats }] = await db
      .select({ value: count() })
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, organizationId));

    const managerUrl = validateEnv().LICENSE_MANAGER_URL;
    const secret = process.env.INTERNAL_API_SECRET;
    if (!managerUrl || !secret) return;
    if (!managerUrl.startsWith("https://")) {
      console.error("[syncOrgSeats] LICENSE_MANAGER_URL doit commencer par https://");
      return;
    }

    const res = await fetch(`${managerUrl}/api/saas/sync-seats`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ orgSlug: org.slug, seats: Math.max(1, seats) }),
    });
    if (!res.ok) {
      console.error(`[syncOrgSeats] échec sync (${res.status}) pour ${org.slug}`);
    }
  } catch (err) {
    console.error("[syncOrgSeats] erreur:", err);
  }
}

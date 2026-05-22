import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Vérifie que l'instance n'a pas encore terminé la configuration initiale.
 * Retourne une NextResponse 403 si setup_completed === true, sinon null.
 * À appeler en tête de chaque route API /api/setup/*.
 */
export async function guardSetupNotCompleted(): Promise<NextResponse | null> {
  const [row] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, "setup_completed"))
    .limit(1);

  if (row?.value === true) {
    return NextResponse.json(
      { error: "L'instance est déjà configurée" },
      { status: 403 }
    );
  }
  return null;
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { favorites } from "@/lib/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";

export async function PATCH(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  let body: { orderedIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const { orderedIds } = body;

  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return NextResponse.json(
      { error: "orderedIds doit être un tableau non vide" },
      { status: 400 }
    );
  }

  // Verify all IDs belong to the user
  const userFavorites = await db
    .select({ id: favorites.id })
    .from(favorites)
    .where(
      and(eq(favorites.userId, user.id), inArray(favorites.id, orderedIds))
    );

  const ownedIds = new Set(userFavorites.map((f) => f.id));
  const unauthorized = orderedIds.filter((id) => !ownedIds.has(id));

  if (unauthorized.length > 0) {
    return NextResponse.json(
      { error: "Certains favoris ne vous appartiennent pas" },
      { status: 403 }
    );
  }

  // Update positions using a CASE expression for a single query
  const caseFragments = orderedIds.map(
    (id, index) => sql`when ${favorites.id} = ${id} then ${index}`
  );

  await db
    .update(favorites)
    .set({
      position: sql`case ${sql.join(caseFragments, sql` `)} end`,
    })
    .where(
      and(eq(favorites.userId, user.id), inArray(favorites.id, orderedIds))
    );

  return NextResponse.json({ success: true });
}

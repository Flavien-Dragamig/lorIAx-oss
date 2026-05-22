import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { favorites } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;

  // Verify the favorite belongs to the user and delete it
  const [deleted] = await db
    .delete(favorites)
    .where(and(eq(favorites.id, id), eq(favorites.userId, user.id)))
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Favori introuvable" }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}

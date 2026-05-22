import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { checkDocumentEditAccess } from "@/lib/auth/check-access";
import { z } from "zod";

const reorderSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid(),
      position: z.number().int().min(0),
      parentId: z.string().uuid().nullable().optional(),
    })
  ),
});

export async function PATCH(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await request.json();
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }

  const { items } = parsed.data;

  // Vérifier les permissions d'édition sur tous les documents
  if (items.length > 0) {
    // Fetch all documents in one query to verify they all belong to the same space
    const docIds = items.map((item) => item.id);
    const docs = await db
      .select({ id: documents.id, spaceId: documents.spaceId })
      .from(documents)
      .where(inArray(documents.id, docIds));

    // All documents must exist
    if (docs.length !== docIds.length) {
      return NextResponse.json({ error: "Documents introuvables" }, { status: 404 });
    }

    // All documents must belong to the same space
    const spaceIds = new Set(docs.map((d) => d.spaceId));
    if (spaceIds.size !== 1) {
      return NextResponse.json({ error: "Tous les documents doivent appartenir au même espace" }, { status: 400 });
    }

    const spaceId = docs[0].spaceId;
    const canEdit = await checkDocumentEditAccess(user, spaceId, docs[0].id);
    if (!canEdit) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  for (const item of items) {
    const updates: Record<string, unknown> = { position: item.position };
    if (item.parentId !== undefined) {
      updates.parentId = item.parentId;
    }
    await db.update(documents).set(updates).where(eq(documents.id, item.id));
  }

  return NextResponse.json({ success: true });
}

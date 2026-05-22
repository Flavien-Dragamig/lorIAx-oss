import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, documentLabels } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { checkDocumentEditAccess } from "@/lib/auth/check-access";

// DELETE /api/documents/[id]/labels/[labelId] — retirer un label du document
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; labelId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id, labelId } = await params;

  const [doc] = await db
    .select({ id: documents.id, spaceId: documents.spaceId })
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);

  if (!doc) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });

  const canEdit = await checkDocumentEditAccess(user, doc.spaceId, doc.id);
  if (!canEdit) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const [deleted] = await db
    .delete(documentLabels)
    .where(
      and(
        eq(documentLabels.documentId, id),
        eq(documentLabels.labelId, labelId)
      )
    )
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Label non assigné à ce document" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

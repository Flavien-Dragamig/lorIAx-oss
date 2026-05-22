import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, documentLabels, labels } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { checkDocumentEditAccess, checkDocumentViewAccess } from "@/lib/auth/check-access";
import { z } from "zod";

// GET /api/documents/[id]/labels — retourne les labels du document
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;

  const [doc] = await db
    .select({ id: documents.id, spaceId: documents.spaceId })
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);

  if (!doc) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });

  const canView = await checkDocumentViewAccess(user, doc.spaceId, doc.id);
  if (!canView) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const result = await db
    .select({
      id: labels.id,
      name: labels.name,
      color: labels.color,
      isGlobal: labels.isGlobal,
      spaceId: labels.spaceId,
      createdBy: labels.createdBy,
      createdAt: labels.createdAt,
    })
    .from(documentLabels)
    .innerJoin(labels, eq(documentLabels.labelId, labels.id))
    .where(eq(documentLabels.documentId, id))
    .orderBy(labels.name);

  return NextResponse.json(result);
}

const assignLabelSchema = z.object({
  labelId: z.string().uuid(),
});

// POST /api/documents/[id]/labels — assigner un label au document
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;

  const [doc] = await db
    .select({ id: documents.id, spaceId: documents.spaceId })
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);

  if (!doc) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });

  const canEdit = await checkDocumentEditAccess(user, doc.spaceId, doc.id);
  if (!canEdit) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const body = await request.json();
  const parsed = assignLabelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  await db
    .insert(documentLabels)
    .values({ documentId: id, labelId: parsed.data.labelId })
    .onConflictDoNothing();

  return NextResponse.json({ success: true }, { status: 201 });
}

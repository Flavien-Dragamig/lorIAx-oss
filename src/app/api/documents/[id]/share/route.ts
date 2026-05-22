import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, spaces, publicShares } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { checkDocumentEditAccess, checkDocumentViewAccess } from "@/lib/auth/check-access";
import { canShareExternally } from "@/lib/auth/classification";
import { logActivity } from "@/lib/activity";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatch";
import { randomBytes } from "crypto";

// POST — Create a public share link
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const { id } = await params;

  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);

  if (!doc) return NextResponse.json({ error: "Document non trouve" }, { status: 404 });

  const canEdit = await checkDocumentEditAccess(user, doc.spaceId, doc.id);
  if (!canEdit) return NextResponse.json({ error: "Acces refuse" }, { status: 403 });

  // Load space
  const [space] = await db
    .select()
    .from(spaces)
    .where(eq(spaces.id, doc.spaceId))
    .limit(1);

  if (!space) return NextResponse.json({ error: "Espace non trouve" }, { status: 404 });

  // Verify classification allows external sharing
  const canShare = canShareExternally(
    doc.classification as "public" | "internal" | "confidential" | "secret",
    space.classification as "public" | "internal" | "confidential" | "secret"
  );
  if (!canShare) {
    return NextResponse.json(
      { error: "Le document et l'espace doivent etre classifies 'public' pour le partage externe" },
      { status: 403 }
    );
  }

  // Generate token
  const token = randomBytes(32).toString("hex");

  // Insert into publicShares
  const [share] = await db
    .insert(publicShares)
    .values({
      documentId: id,
      token,
      createdBy: user.id,
    })
    .returning();

  // Log activity
  logActivity({
    userId: user.id,
    action: "create",
    entityType: "share",
    entityId: share.id,
    metadata: { documentId: id, token },
  });

  // Dispatch webhook
  dispatchWebhookEvent(
    "share.created",
    { documentId: id, shareId: share.id, token },
    user.id
  );

  return NextResponse.json({
    id: share.id,
    token: share.token,
    url: `/public/${share.token}`,
    createdAt: share.createdAt,
  });
}

// GET — List active shares for a document
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const { id } = await params;

  const [doc] = await db
    .select({ spaceId: documents.spaceId })
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);

  if (!doc) return NextResponse.json({ error: "Document non trouve" }, { status: 404 });

  const canView = await checkDocumentViewAccess(user, doc.spaceId, id);
  if (!canView) return NextResponse.json({ error: "Acces refuse" }, { status: 403 });

  const shares = await db
    .select()
    .from(publicShares)
    .where(
      and(
        eq(publicShares.documentId, id),
        isNull(publicShares.revokedAt)
      )
    );

  return NextResponse.json(shares);
}

// DELETE — Revoke a share link
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const { id } = await params;

  const body = await request.json();
  const { shareId } = body as { shareId: string };

  if (!shareId) {
    return NextResponse.json({ error: "shareId requis" }, { status: 400 });
  }

  const [doc] = await db
    .select({ spaceId: documents.spaceId })
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);

  if (!doc) return NextResponse.json({ error: "Document non trouve" }, { status: 404 });

  const canEdit = await checkDocumentEditAccess(user, doc.spaceId, id);
  if (!canEdit) return NextResponse.json({ error: "Acces refuse" }, { status: 403 });

  // Revoke the share
  await db
    .update(publicShares)
    .set({ revokedAt: new Date() })
    .where(eq(publicShares.id, shareId));

  // Log activity
  logActivity({
    userId: user.id,
    action: "revoke",
    entityType: "share",
    entityId: shareId,
    metadata: { documentId: id },
  });

  // Dispatch webhook
  dispatchWebhookEvent(
    "share.revoked",
    { documentId: id, shareId },
    user.id
  );

  return NextResponse.json({ success: true });
}

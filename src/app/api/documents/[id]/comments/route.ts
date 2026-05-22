import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documentComments, users, documents } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { checkDocumentViewAccess, checkDocumentEditAccess } from "@/lib/auth/check-access";
import { createNotification } from "@/lib/notifications";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id: documentId } = await params;

  // Vérifier l'accès au document
  const [doc] = await db
    .select({ spaceId: documents.spaceId })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);
  if (!doc) return NextResponse.json({ error: "Document non trouvé" }, { status: 404 });
  const canView = await checkDocumentViewAccess(user, doc.spaceId, documentId);
  if (!canView) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const comments = await db
    .select({
      id: documentComments.id,
      content: documentComments.content,
      parentId: documentComments.parentId,
      resolved: documentComments.resolved,
      createdAt: documentComments.createdAt,
      updatedAt: documentComments.updatedAt,
      author: {
        id: users.id,
        name: users.name,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(documentComments)
    .innerJoin(users, eq(documentComments.userId, users.id))
    .where(eq(documentComments.documentId, documentId))
    .orderBy(asc(documentComments.createdAt));

  // Build threaded structure: top-level comments with nested replies
  const topLevel = comments.filter((c) => !c.parentId);
  const replies = comments.filter((c) => c.parentId);

  const threaded = topLevel.map((comment) => ({
    ...comment,
    replies: replies.filter((r) => r.parentId === comment.id),
  }));

  return NextResponse.json(threaded);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id: documentId } = await params;

  // Vérifier l'accès au document
  const [docForPost] = await db
    .select({ spaceId: documents.spaceId })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);
  if (!docForPost) return NextResponse.json({ error: "Document non trouvé" }, { status: 404 });
  const canViewForPost = await checkDocumentViewAccess(user, docForPost.spaceId, documentId);
  if (!canViewForPost) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const body = await request.json();
  const { content, parentId } = body;

  if (!content || typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "Contenu requis" }, { status: 400 });
  }

  const [comment] = await db
    .insert(documentComments)
    .values({
      documentId,
      userId: user.id,
      content: content.trim(),
      parentId: parentId || null,
    })
    .returning();

  // --- Notifications ---
  const [doc] = await db
    .select({ title: documents.title, createdBy: documents.createdBy })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  if (parentId) {
    // Reply → notifier l'auteur du commentaire parent
    const [parentComment] = await db
      .select({ userId: documentComments.userId })
      .from(documentComments)
      .where(eq(documentComments.id, parentId))
      .limit(1);

    if (parentComment) {
      await createNotification({
        userId: parentComment.userId,
        type: "reply",
        title: `${user.name} a répondu à votre commentaire`,
        message: content.trim().slice(0, 200),
        documentId,
        actorId: user.id,
      });
    }
  }

  if (doc && doc.createdBy !== user.id) {
    // Notifier l'auteur du document (sauf si c'est un reply à soi-même déjà notifié)
    await createNotification({
      userId: doc.createdBy,
      type: "comment",
      title: `${user.name} a commenté « ${doc.title} »`,
      message: content.trim().slice(0, 200),
      documentId,
      actorId: user.id,
    });
  }

  return NextResponse.json(comment, { status: 201 });
}

export async function PATCH(
  request: NextRequest,
  { params: _params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await request.json();
  const { commentId, content, resolved } = body;

  if (!commentId) {
    return NextResponse.json({ error: "commentId requis" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(documentComments)
    .where(eq(documentComments.id, commentId))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Commentaire non trouvé" }, { status: 404 });
  }

  // Verify user has access to the document containing this comment
  const [commentDoc] = await db
    .select({ spaceId: documents.spaceId })
    .from(documents)
    .where(eq(documents.id, existing.documentId))
    .limit(1);
  if (!commentDoc) return NextResponse.json({ error: "Document non trouvé" }, { status: 404 });

  const canEdit = await checkDocumentEditAccess(user, commentDoc.spaceId, existing.documentId);
  if (!canEdit) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (typeof content === "string" && existing.userId === user.id) {
    updates.content = content.trim();
  }

  if (resolved !== undefined) {
    updates.resolved = resolved;
  }

  await db.update(documentComments).set(updates).where(eq(documentComments.id, commentId));

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params: _params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await request.json();
  const { commentId } = body;

  if (!commentId) {
    return NextResponse.json({ error: "commentId requis" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(documentComments)
    .where(eq(documentComments.id, commentId))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Commentaire non trouvé" }, { status: 404 });
  }

  // Verify user has access to the document
  const [commentDocDel] = await db
    .select({ spaceId: documents.spaceId })
    .from(documents)
    .where(eq(documents.id, existing.documentId))
    .limit(1);
  if (!commentDocDel) return NextResponse.json({ error: "Document non trouvé" }, { status: 404 });

  const canEditDel = await checkDocumentViewAccess(user, commentDocDel.spaceId, existing.documentId);
  if (!canEditDel) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  // Only author or admin can delete
  if (existing.userId !== user.id && user.globalRole !== "admin" && user.globalRole !== "super_admin") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  await db.delete(documentComments).where(eq(documentComments.id, commentId));

  return NextResponse.json({ success: true });
}

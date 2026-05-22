import { db } from "@/lib/db";
import { documents, documentComments, users } from "@/lib/db/schema";
import { eq, and, gt, asc } from "drizzle-orm";
import { authenticateApiRequest, requireScope } from "@/lib/api/auth-api";
import { apiSuccess, apiError } from "@/lib/api/response";
import { checkDocumentViewAccess, checkDocumentEditAccess } from "@/lib/auth/check-access";
import { z } from "zod";

const createCommentSchema = z.object({
  content: z.string().min(1).max(10000),
  parentId: z.string().uuid().optional(),
});

/**
 * GET /api/v1/documents/:id/comments — List comments.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await authenticateApiRequest(request);
  if ("error" in auth) return auth.error;

  const scopeErr = requireScope(auth.user, "documents:read");
  if (scopeErr) return scopeErr;

  const [doc] = await db
    .select({ id: documents.id, spaceId: documents.spaceId })
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);

  if (!doc) return apiError("Document introuvable", 404);

  const canView = await checkDocumentViewAccess(
    auth.user,
    doc.spaceId,
    doc.id
  );
  if (!canView) return apiError("Accès refusé", 403);

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

  const conditions = [eq(documentComments.documentId, id)];
  if (cursor) conditions.push(gt(documentComments.id, cursor));

  const comments = await db
    .select({
      id: documentComments.id,
      content: documentComments.content,
      parentId: documentComments.parentId,
      resolved: documentComments.resolved,
      createdAt: documentComments.createdAt,
      authorId: documentComments.userId,
      authorName: users.name,
      authorEmail: users.email,
    })
    .from(documentComments)
    .innerJoin(users, eq(documentComments.userId, users.id))
    .where(and(...conditions))
    .orderBy(asc(documentComments.createdAt))
    .limit(limit + 1);

  const hasMore = comments.length > limit;
  const data = hasMore ? comments.slice(0, limit) : comments;
  const nextCursor = hasMore ? data[data.length - 1]?.id : null;

  return apiSuccess(data, { cursor: nextCursor, hasMore });
}

/**
 * POST /api/v1/documents/:id/comments — Create a comment.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await authenticateApiRequest(request);
  if ("error" in auth) return auth.error;

  const scopeErr = requireScope(auth.user, "documents:write");
  if (scopeErr) return scopeErr;

  const body = await request.json();
  const parsed = createCommentSchema.safeParse(body);
  if (!parsed.success) return apiError("Données invalides", 400);

  const [doc] = await db
    .select({ id: documents.id, spaceId: documents.spaceId })
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);

  if (!doc) return apiError("Document introuvable", 404);

  const canEdit = await checkDocumentEditAccess(
    auth.user,
    doc.spaceId,
    doc.id
  );
  if (!canEdit) return apiError("Accès refusé", 403);

  const [created] = await db
    .insert(documentComments)
    .values({
      documentId: id,
      userId: auth.user.id,
      content: parsed.data.content,
      parentId: parsed.data.parentId || null,
    })
    .returning();

  return apiSuccess(created, undefined, 201);
}

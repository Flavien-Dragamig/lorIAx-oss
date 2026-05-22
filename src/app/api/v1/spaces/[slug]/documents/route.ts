import { db } from "@/lib/db";
import { documents, spaces } from "@/lib/db/schema";
import { eq, and, gt, asc, isNull } from "drizzle-orm";
import { authenticateApiRequest, requireScope } from "@/lib/api/auth-api";
import { apiSuccess, apiError } from "@/lib/api/response";

/**
 * GET /api/v1/spaces/:slug/documents — List documents in a space.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const auth = await authenticateApiRequest(request);
  if ("error" in auth) return auth.error;

  const scopeErr = requireScope(auth.user, "documents:read");
  if (scopeErr) return scopeErr;

  // Find space
  const [space] = await db
    .select({ id: spaces.id, name: spaces.name })
    .from(spaces)
    .where(eq(spaces.slug, slug))
    .limit(1);

  if (!space) {
    return apiError("Espace introuvable", 404);
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
  const parentId = searchParams.get("parentId") || null;

  const conditions = [eq(documents.spaceId, space.id)];

  if (parentId) {
    conditions.push(eq(documents.parentId, parentId));
  } else {
    conditions.push(isNull(documents.parentId));
  }

  if (cursor) {
    conditions.push(gt(documents.id, cursor));
  }

  const results = await db
    .select({
      id: documents.id,
      title: documents.title,
      slug: documents.slug,
      icon: documents.icon,
      isFolder: documents.isFolder,
      visibility: documents.visibility,
      parentId: documents.parentId,
      position: documents.position,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .where(and(...conditions))
    .orderBy(asc(documents.position), asc(documents.id))
    .limit(limit + 1);

  const hasMore = results.length > limit;
  const data = hasMore ? results.slice(0, limit) : results;
  const nextCursor = hasMore ? data[data.length - 1]?.id : null;

  return apiSuccess(data, { cursor: nextCursor, hasMore });
}

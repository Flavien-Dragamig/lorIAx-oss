import { db } from "@/lib/db";
import { spaces } from "@/lib/db/schema";
import { eq, or, sql, gt, asc, ne } from "drizzle-orm";
import { authenticateApiRequest, requireScope } from "@/lib/api/auth-api";
import { apiSuccess } from "@/lib/api/response";

/**
 * GET /api/v1/spaces — List accessible spaces.
 */
export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if ("error" in auth) return auth.error;

  const scopeErr = requireScope(auth.user, "spaces:read");
  if (scopeErr) return scopeErr;

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

  const isAdmin =
    auth.user.globalRole === "admin" ||
    auth.user.globalRole === "super_admin";

  // Build where clause
  const conditions = [];
  if (!isAdmin) {
    // Owned spaces + spaces with permission
    conditions.push(
      or(
        eq(spaces.ownerUserId, auth.user.id),
        sql`${spaces.id} IN (SELECT space_id FROM space_permissions WHERE user_id = ${auth.user.id})`
      )
    );
    // Masquer les espaces secret pour les non-admins
    conditions.push(ne(spaces.classification, "secret"));
  }

  if (cursor) {
    conditions.push(gt(spaces.id, cursor));
  }

  const where =
    conditions.length > 0
      ? sql`${sql.join(conditions, sql` AND `)}`
      : undefined;

  const results = await db
    .select({
      id: spaces.id,
      name: spaces.name,
      slug: spaces.slug,
      type: spaces.type,
      description: spaces.description,
      icon: spaces.icon,
      createdAt: spaces.createdAt,
      updatedAt: spaces.updatedAt,
    })
    .from(spaces)
    .where(where)
    .orderBy(asc(spaces.id))
    .limit(limit + 1);

  const hasMore = results.length > limit;
  const data = hasMore ? results.slice(0, limit) : results;
  const nextCursor = hasMore ? data[data.length - 1]?.id : null;

  return apiSuccess(data, {
    cursor: nextCursor,
    hasMore,
  });
}

import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { authenticateApiRequest, requireScope } from "@/lib/api/auth-api";
import { apiSuccess, apiError } from "@/lib/api/response";
import { getAccessibleSpaceIds, isGlobalAdmin } from "@/lib/auth/check-access";

/**
 * GET /api/v1/search?q=... — Full-text search across documents.
 */
export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if ("error" in auth) return auth.error;

  const scopeErr = requireScope(auth.user, "search");
  if (scopeErr) return scopeErr;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

  if (!query || query.length < 2) {
    return apiError("Le paramètre q doit contenir au moins 2 caractères", 400);
  }

  const user = auth.user;
  const admin = isGlobalAdmin(user);
  const spaceIds = admin ? [] : await getAccessibleSpaceIds(user);

  // Build space filter
  const spaceFilter = admin
    ? sql`1=1`
    : spaceIds.length > 0
      ? sql`d.space_id IN (${sql.join(
          spaceIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      : sql`1=0`;

  // Full-text search with tsvector
  const results = await db.execute(sql`
    SELECT
      d.id,
      d.title,
      d.slug,
      d.icon,
      d.space_id AS "spaceId",
      s.name AS "spaceName",
      s.slug AS "spaceSlug",
      d.updated_at AS "updatedAt",
      ts_rank(to_tsvector('french', coalesce(d.title, '') || ' ' || coalesce(d.content_text, '')), plainto_tsquery('french', ${query})) AS rank
    FROM documents d
    JOIN spaces s ON s.id = d.space_id
    WHERE ${spaceFilter}
      AND d.is_folder = false
      AND to_tsvector('french', coalesce(d.title, '') || ' ' || coalesce(d.content_text, '')) @@ plainto_tsquery('french', ${query})
    ORDER BY rank DESC
    LIMIT ${limit}
  `);

  return apiSuccess(results.rows);
}

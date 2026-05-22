import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, spaces } from "@/lib/db/schema";
import { eq, sql, inArray, and } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";

/** Ligne brute retournée par db.execute() pour les recherches de documents */
interface RawDocumentRow {
  id: string;
  title: string;
  slug: string;
  space_slug?: string;
  spaceSlug?: string;
  space_name?: string;
  spaceName?: string;
  content_text?: string;
  contentText?: string;
  rank?: string;
  [key: string]: unknown;
}

/** Ligne brute pour les événements calendrier */
interface RawEventRow {
  id: string;
  title: string;
  description?: string;
  location?: string;
  start_at: string | Date;
  end_at?: string | Date;
  calendar_id?: string;
  [key: string]: unknown;
}
import { getAccessibleSpaceIds, isGlobalAdmin } from "@/lib/auth/check-access";
import { searchSemantic, isEmbeddingConfigured } from "@/lib/ai/embeddings";
import logger from "@/lib/logger";
import { headers } from "next/headers";
import { getOrgId, getOrgSlugFromHeaders } from "@/lib/org/get-org-id";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ results: [] }, { status: 401 });

  const orgSlug = await getOrgSlugFromHeaders(headers);
  const orgId = await getOrgId(orgSlug);

  const q = request.nextUrl.searchParams.get("q") || "";
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "20");
  const spaceSlugFilter = request.nextUrl.searchParams.get("space") || "";
  const scope = (request.nextUrl.searchParams.get("scope") || "all") as "title" | "content" | "all";

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  // Déterminer les espaces accessibles
  const spaceIds = await getAccessibleSpaceIds(user);
  const admin = isGlobalAdmin(user);

  // Si filtre par espace, résoudre le slug vers l'ID
  let filteredSpaceId: string | null = null;
  if (spaceSlugFilter) {
    const [space] = await db
      .select({ id: spaces.id })
      .from(spaces)
      .where(eq(spaces.slug, spaceSlugFilter))
      .limit(1);
    if (space && (admin || spaceIds.includes(space.id))) {
      filteredSpaceId = space.id;
    }
  }

  // Clause SQL de filtrage par espace
  const spaceFilter = filteredSpaceId
    ? sql`d.space_id = ${filteredSpaceId}`
    : admin
    ? sql`1=1`
    : spaceIds.length > 0
    ? sql`d.space_id IN (${sql.join(spaceIds.map((id) => sql`${id}`), sql`, `)})`
    : sql`1=0`;

  // SEC-02 — Filtrage par classification de sécurité
  // Les documents « secret » ne sont visibles que par leur auteur et les admins
  const classificationFilter = admin
    ? sql`1=1`
    : sql`(d.classification != 'secret' OR d.created_by = ${user.id})`;

  const formatted: Array<{
    id: string;
    title: string;
    spaceSlug: string;
    spaceName: string;
    excerpt: string;
    score: number;
    type: string;
  }> = [];

  const pattern = `%${q}%`;
  const existingIds = new Set<string>();

  function pushResult(r: RawDocumentRow, scoreVal: number, fromContentText = true) {
    if (existingIds.has(r.id)) return;
    existingIds.add(r.id);
    const contentText = fromContentText ? r.content_text : r.contentText;
    formatted.push({
      id: r.id,
      title: r.title,
      spaceSlug: (r.space_slug ?? r.spaceSlug) || "",
      spaceName: (r.space_name ?? r.spaceName) || "",
      excerpt: buildExcerpt(contentText ?? null, q),
      score: scoreVal,
      type: "fts",
    });
  }

  // ─── Stratégie hybride ─────────────────────────────────────────────────
  // Requêtes courtes (< 4 chars) ou scope restreint → ILIKE directement
  // Requêtes longues + scope all/content → FTS d'abord, ILIKE en complément

  const useIlikeOnly = q.length < 4 || scope === "title";

  if (!useIlikeOnly) {
    // FTS français sur titre + contenu
    try {
      const ftsResults = await db.execute(sql`
        SELECT
          d.id, d.title, d.slug,
          s.slug AS space_slug, s.name AS space_name,
          d.content_text, d.updated_at,
          ts_rank(d.search_vector, plainto_tsquery('french', ${q})) AS rank
        FROM documents d
        INNER JOIN spaces s ON d.space_id = s.id
        WHERE d.search_vector @@ plainto_tsquery('french', ${q})
          AND s.organization_id = ${orgId}
          AND ${spaceFilter}
          AND ${classificationFilter}
        ORDER BY rank DESC
        LIMIT ${limit}
      `);

      for (const r of ftsResults.rows as RawDocumentRow[]) {
        pushResult(r, parseFloat(r.rank ?? "0") || 1);
      }
    } catch {
      // FTS non disponible, on continue avec ILIKE
    }
  }

  // ILIKE en complément (ou seul pour les requêtes courtes)
  // Construit la clause WHERE selon le scope
  const ilikeCondition =
    scope === "title"
      ? sql`d.title ILIKE ${pattern}`
      : scope === "content"
      ? sql`d.content_text ILIKE ${pattern}`
      : sql`(d.title ILIKE ${pattern} OR d.content_text ILIKE ${pattern})`;

  // Ne lancer ILIKE que si on n'a pas assez de résultats, ou si requête courte
  if (formatted.length < limit) {
    try {
      const ilikeResults = await db.execute(sql`
        SELECT
          d.id, d.title, d.slug,
          s.slug AS space_slug, s.name AS space_name,
          d.content_text, d.updated_at
        FROM documents d
        INNER JOIN spaces s ON d.space_id = s.id
        WHERE ${ilikeCondition}
          AND s.organization_id = ${orgId}
          AND ${spaceFilter}
          AND ${classificationFilter}
        ORDER BY d.updated_at DESC
        LIMIT ${limit}
      `);

      for (const r of ilikeResults.rows as RawDocumentRow[]) {
        pushResult(r, 0.8);
      }
    } catch {
      // ILIKE fallback échoué
    }
  }

  // Filet de sécurité : ILIKE sur titre uniquement si scope == "all"
  // pour couvrir les termes courts filtrés par FTS (ex: "CA")
  if (scope === "all" && formatted.length < limit) {
    try {
      const titleResults = await db.execute(sql`
        SELECT
          d.id, d.title, d.slug,
          s.slug AS space_slug, s.name AS space_name,
          d.content_text, d.updated_at
        FROM documents d
        INNER JOIN spaces s ON d.space_id = s.id
        WHERE d.title ILIKE ${pattern}
          AND s.organization_id = ${orgId}
          AND ${spaceFilter}
          AND ${classificationFilter}
        ORDER BY d.updated_at DESC
        LIMIT ${limit}
      `);

      for (const r of titleResults.rows as RawDocumentRow[]) {
        pushResult(r, 0.9);
      }
    } catch {
      // Fallback titre échoué
    }
  }

  // ─── Recherche sémantique si configurée ───────────────────────────────
  if (isEmbeddingConfigured()) {
    try {
      const semanticResults = await searchSemantic(q, limit);

      // Filtrer les documents déjà dans les résultats FTS
      const newResults = semanticResults.filter(
        (sr) => !existingIds.has(sr.documentId)
      );

      if (newResults.length > 0) {
        // Charger tous les documents en une seule requête (fix N+1)
        const docIds = [...new Set(newResults.map((sr) => sr.documentId))];
        const docs = await db
          .select({
            id: documents.id,
            title: documents.title,
            slug: documents.slug,
            spaceId: documents.spaceId,
            classification: documents.classification,
            createdBy: documents.createdBy,
            spaceSlug: spaces.slug,
            spaceName: spaces.name,
          })
          .from(documents)
          .innerJoin(spaces, eq(documents.spaceId, spaces.id))
          .where(and(inArray(documents.id, docIds), eq(spaces.organizationId, orgId)));

        const docsMap = new Map(docs.map((d) => [d.id, d]));

        for (const sr of newResults) {
          const doc = docsMap.get(sr.documentId);
          if (!doc) continue;

          // Filtrer par espace accessible + classification
          if (!admin && !spaceIds.includes(doc.spaceId)) continue;
          if (!admin && doc.classification === "secret" && doc.createdBy !== user.id) continue;
          if (existingIds.has(doc.id)) continue;
          existingIds.add(doc.id);

          formatted.push({
            id: doc.id,
            title: doc.title,
            spaceSlug: doc.spaceSlug,
            spaceName: doc.spaceName,
            excerpt: sr.chunkText.slice(0, 150) + "...",
            score: sr.score,
            type: "semantic",
          });
        }
      }
    } catch (error) {
      logger.error({ err: error }, "Erreur recherche sémantique");
    }
  }

  // ─── Recherche dans les événements calendrier ──────────────────────────
  try {
    const eventPattern = `%${q}%`;

    // Tenant isolation: filter events by calendars the user can access
    // Org filter: only calendars whose space belongs to the current org (or personal calendars)
    const calendarOrgFilter = orgId
      ? sql`(c.space_id IS NULL OR c.space_id IN (SELECT id FROM spaces WHERE organization_id = ${orgId}))`
      : sql`1=1`;

    const calendarAccessFilter = admin
      ? sql`ce.calendar_id IN (SELECT c.id FROM calendars c WHERE ${calendarOrgFilter})`
      : spaceIds.length > 0
      ? sql`ce.calendar_id IN (
          SELECT c.id FROM calendars c
          WHERE (c.owner_user_id = ${user.id}
             OR c.space_id IN (${sql.join(spaceIds.map((id) => sql`${id}`), sql`, `)}))
            AND ${calendarOrgFilter}
        )`
      : sql`ce.calendar_id IN (
          SELECT c.id FROM calendars c
          WHERE c.owner_user_id = ${user.id}
            AND ${calendarOrgFilter}
        )`;

    const eventResults = await db.execute(sql`
      SELECT ce.id, ce.title, ce.description, ce.location, ce.start_at, ce.end_at, ce.calendar_id
      FROM calendar_events ce
      WHERE (ce.title ILIKE ${eventPattern} OR ce.description ILIKE ${eventPattern} OR ce.location ILIKE ${eventPattern})
        AND ${calendarAccessFilter}
      ORDER BY ce.start_at DESC
      LIMIT 5
    `);

    for (const r of eventResults.rows as RawEventRow[]) {
      const startDate = new Date(r.start_at);
      const dateStr = startDate.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      formatted.push({
        id: `event-${r.id}`,
        title: `📅 ${r.title}`,
        spaceSlug: "calendar",
        spaceName: `Événement — ${dateStr}`,
        excerpt: r.description?.slice(0, 120) || (r.location ? `Lieu : ${r.location}` : ""),
        score: 0.7,
        type: "calendar",
      });
    }
  } catch {
    // Calendar search failed (table may not exist yet)
  }

  // Trier par score décroissant
  formatted.sort((a, b) => b.score - a.score);

  return NextResponse.json({ results: formatted.slice(0, limit) });
}

function buildExcerpt(contentText: string | null, query: string): string {
  if (!contentText) return "";
  const idx = contentText.toLowerCase().indexOf(query.toLowerCase());
  if (idx >= 0) {
    const start = Math.max(0, idx - 50);
    const end = Math.min(contentText.length, idx + query.length + 50);
    return (
      (start > 0 ? "..." : "") +
      contentText.slice(start, end) +
      (end < contentText.length ? "..." : "")
    );
  }
  return contentText.slice(0, 120) + "...";
}

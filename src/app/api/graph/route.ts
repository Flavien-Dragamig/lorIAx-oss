import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, documentLinks, spaces } from "@/lib/db/schema";
import { eq, inArray, or, and } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { getAccessibleSpaceIds, isGlobalAdmin } from "@/lib/auth/check-access";
import type { GraphData } from "@/types";
import { headers } from "next/headers";
import { getOrgId, getOrgSlugFromHeaders } from "@/lib/org/get-org-id";

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 2000;

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ nodes: [], edges: [] }, { status: 401 });

  const orgSlug = await getOrgSlugFromHeaders(headers);
  const orgId = await getOrgId(orgSlug);

  const spaceId = request.nextUrl.searchParams.get("spaceId");
  const limitParam = parseInt(request.nextUrl.searchParams.get("limit") || String(DEFAULT_LIMIT));
  const offsetParam = parseInt(request.nextUrl.searchParams.get("offset") || "0");
  const limit = Math.min(Math.max(1, limitParam), MAX_LIMIT);
  const offset = Math.max(0, offsetParam);

  // Déterminer les espaces accessibles
  const admin = isGlobalAdmin(user);
  const spaceIds = admin ? [] : await getAccessibleSpaceIds(user);

  // Si un spaceId est fourni, vérifier que l'utilisateur y a accès
  if (spaceId && !admin && !spaceIds.includes(spaceId)) {
    return NextResponse.json({ nodes: [], edges: [] }, { status: 403 });
  }

  // PERF-02 — Récupérer les documents avec pagination
  const docSelect = {
    id: documents.id,
    title: documents.title,
    spaceId: documents.spaceId,
    slug: documents.slug,
  };

  let docs;
  if (spaceId) {
    docs = await db
      .select(docSelect)
      .from(documents)
      .innerJoin(spaces, eq(documents.spaceId, spaces.id))
      .where(and(eq(documents.spaceId, spaceId), eq(spaces.organizationId, orgId)))
      .limit(limit)
      .offset(offset);
  } else if (admin) {
    docs = await db
      .select(docSelect)
      .from(documents)
      .innerJoin(spaces, eq(documents.spaceId, spaces.id))
      .where(eq(spaces.organizationId, orgId))
      .limit(limit)
      .offset(offset);
  } else if (spaceIds.length > 0) {
    docs = await db
      .select(docSelect)
      .from(documents)
      .innerJoin(spaces, eq(documents.spaceId, spaces.id))
      .where(and(inArray(documents.spaceId, spaceIds), eq(spaces.organizationId, orgId)))
      .limit(limit)
      .offset(offset);
  } else {
    return NextResponse.json({ nodes: [], edges: [], hasMore: false });
  }

  // PERF-02 — Filtrer les liens par docIds chargés (au lieu de tout charger)
  const docIds = docs.map((d) => d.id);

  let filteredLinks: Array<{ sourceId: string; targetId: string; linkText: string | null }> = [];
  if (docIds.length > 0) {
    const links = await db
      .select({
        sourceId: documentLinks.sourceId,
        targetId: documentLinks.targetId,
        linkText: documentLinks.linkText,
      })
      .from(documentLinks)
      .where(
        or(
          inArray(documentLinks.sourceId, docIds),
          inArray(documentLinks.targetId, docIds)
        )
      );

    // Ne garder que les liens dont les deux extrémités sont dans les docs chargés
    const docIdSet = new Set(docIds);
    filteredLinks = links.filter(
      (l) => docIdSet.has(l.sourceId) && docIdSet.has(l.targetId)
    );
  }

  // Compter les liens par document
  const linkCounts = new Map<string, number>();
  for (const link of filteredLinks) {
    linkCounts.set(link.sourceId, (linkCounts.get(link.sourceId) || 0) + 1);
    linkCounts.set(link.targetId, (linkCounts.get(link.targetId) || 0) + 1);
  }

  const graphData: GraphData & { hasMore: boolean } = {
    nodes: docs.map((d) => ({
      id: d.id,
      title: d.title,
      spaceId: d.spaceId,
      linkCount: linkCounts.get(d.id) || 0,
    })),
    edges: filteredLinks.map((l) => ({
      source: l.sourceId,
      target: l.targetId,
      linkText: l.linkText || undefined,
    })),
    hasMore: docs.length === limit,
  };

  return NextResponse.json(graphData);
}

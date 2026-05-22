import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, spaces } from "@/lib/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { getAccessibleSpaceIds, isGlobalAdmin } from "@/lib/auth/check-access";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json([], { status: 401 });

  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "10");

  // Filtrer par espaces accessibles
  const spaceIds = await getAccessibleSpaceIds(user);

  const query = db
    .select({
      id: documents.id,
      title: documents.title,
      slug: documents.slug,
      updatedAt: documents.updatedAt,
      spaceSlug: spaces.slug,
      spaceName: spaces.name,
    })
    .from(documents)
    .innerJoin(spaces, eq(documents.spaceId, spaces.id))
    .where(eq(documents.isFolder, false))
    .orderBy(desc(documents.updatedAt))
    .limit(limit);

  // Si admin → pas de filtre. Sinon, filtrer par espaces accessibles.
  let recentDocs;
  if (isGlobalAdmin(user)) {
    recentDocs = await query;
  } else if (spaceIds.length === 0) {
    return NextResponse.json([]);
  } else {
    recentDocs = await db
      .select({
        id: documents.id,
        title: documents.title,
        slug: documents.slug,
        updatedAt: documents.updatedAt,
        spaceSlug: spaces.slug,
        spaceName: spaces.name,
      })
      .from(documents)
      .innerJoin(spaces, eq(documents.spaceId, spaces.id))
      .where(inArray(documents.spaceId, spaceIds))
      .orderBy(desc(documents.updatedAt))
      .limit(limit);
  }

  return NextResponse.json(recentDocs);
}

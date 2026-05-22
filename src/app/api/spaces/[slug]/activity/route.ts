import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { spaces, activityLog, users } from "@/lib/db/schema";
import { eq, desc, and, or, sql } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { slug } = await params;
  const [space] = await db
    .select()
    .from(spaces)
    .where(eq(spaces.slug, slug))
    .limit(1);

  if (!space) {
    return NextResponse.json({ error: "Espace introuvable" }, { status: 404 });
  }

  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50");
  const offset = parseInt(request.nextUrl.searchParams.get("offset") || "0");

  // Récupérer les activités liées à cet espace (espace lui-même + documents de l'espace)
  const activities = await db
    .select({
      id: activityLog.id,
      action: activityLog.action,
      entityType: activityLog.entityType,
      entityId: activityLog.entityId,
      metadata: activityLog.metadata,
      createdAt: activityLog.createdAt,
      userId: activityLog.userId,
      userName: users.name,
      userEmail: users.email,
    })
    .from(activityLog)
    .leftJoin(users, eq(activityLog.userId, users.id))
    .where(
      or(
        and(
          eq(activityLog.entityType, "space"),
          eq(activityLog.entityId, space.id)
        ),
        // Documents de cet espace — on stocke spaceId dans metadata
        and(
          eq(activityLog.entityType, "document"),
          sql`${activityLog.metadata}->>'spaceId' = ${space.id}`
        )
      )
    )
    .orderBy(desc(activityLog.createdAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json(activities);
}

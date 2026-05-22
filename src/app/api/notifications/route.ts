import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifications, users, documents, spaces } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { sql } from "drizzle-orm";

// GET — Liste des notifications de l'utilisateur connecté
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const limit = Number(request.nextUrl.searchParams.get("limit")) || 30;

  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      message: notifications.message,
      read: notifications.read,
      createdAt: notifications.createdAt,
      documentId: notifications.documentId,
      actor: {
        id: users.id,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
      },
      documentTitle: documents.title,
      spaceSlug: spaces.slug,
    })
    .from(notifications)
    .leftJoin(users, eq(notifications.actorId, users.id))
    .leftJoin(documents, eq(notifications.documentId, documents.id))
    .leftJoin(spaces, eq(documents.spaceId, spaces.id))
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  // Count unread
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(
      and(eq(notifications.userId, user.id), eq(notifications.read, false))
    );

  return NextResponse.json({ notifications: rows, unreadCount: count });
}

// PATCH — Marquer lu (un ou tous)
export async function PATCH(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await request.json();
  const { notificationId, markAllRead } = body;

  if (markAllRead) {
    await db
      .update(notifications)
      .set({ read: true })
      .where(
        and(eq(notifications.userId, user.id), eq(notifications.read, false))
      );
    return NextResponse.json({ success: true });
  }

  if (!notificationId) {
    return NextResponse.json(
      { error: "notificationId ou markAllRead requis" },
      { status: 400 }
    );
  }

  await db
    .update(notifications)
    .set({ read: true })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, user.id)
      )
    );

  return NextResponse.json({ success: true });
}

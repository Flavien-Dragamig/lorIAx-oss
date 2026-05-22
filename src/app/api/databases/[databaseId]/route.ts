import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  userDatabases,
  userDatabaseColumns,
  userDatabaseRows,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { getSpacePermission } from "@/lib/auth/check-access";
import { z } from "zod";

async function getDatabase(databaseId: string) {
  const [database] = await db
    .select()
    .from(userDatabases)
    .where(eq(userDatabases.id, databaseId))
    .limit(1);
  return database ?? null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ databaseId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { databaseId } = await params;
  const database = await getDatabase(databaseId);
  if (!database) {
    return NextResponse.json({ error: "Base introuvable" }, { status: 404 });
  }

  const [columns, rows] = await Promise.all([
    db
      .select()
      .from(userDatabaseColumns)
      .where(eq(userDatabaseColumns.databaseId, databaseId))
      .orderBy(userDatabaseColumns.position),
    db
      .select()
      .from(userDatabaseRows)
      .where(eq(userDatabaseRows.databaseId, databaseId))
      .orderBy(userDatabaseRows.position),
  ]);

  return NextResponse.json({ ...database, columns, rows });
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ databaseId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { databaseId } = await params;
  const database = await getDatabase(databaseId);
  if (!database) {
    return NextResponse.json({ error: "Base introuvable" }, { status: 404 });
  }

  const perm = await getSpacePermission(user.id, database.spaceId);
  if (!perm || perm === "viewer") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const [updated] = await db
    .update(userDatabases)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(userDatabases.id, databaseId))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ databaseId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { databaseId } = await params;
  const database = await getDatabase(databaseId);
  if (!database) {
    return NextResponse.json({ error: "Base introuvable" }, { status: 404 });
  }

  const perm = await getSpacePermission(user.id, database.spaceId);
  if (!perm || perm === "viewer") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  await db.delete(userDatabases).where(eq(userDatabases.id, databaseId));

  return NextResponse.json({ ok: true });
}

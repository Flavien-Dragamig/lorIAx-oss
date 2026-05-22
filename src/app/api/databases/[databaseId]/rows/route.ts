import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userDatabases, userDatabaseRows } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { getSpacePermission } from "@/lib/auth/check-access";
import { z } from "zod";

async function getDatabaseWithAccess(databaseId: string, userId: string) {
  const [database] = await db
    .select()
    .from(userDatabases)
    .where(eq(userDatabases.id, databaseId))
    .limit(1);
  if (!database) return { database: null, allowed: false };

  const perm = await getSpacePermission(userId, database.spaceId);
  const allowed = !!perm && perm !== "viewer";
  return { database, allowed };
}

const createRowSchema = z.object({
  cells: z.record(z.string(), z.any()).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ databaseId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { databaseId } = await params;
  const { database, allowed } = await getDatabaseWithAccess(databaseId, user.id);
  if (!database) return NextResponse.json({ error: "Base introuvable" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const body = await request.json();
  const parsed = createRowSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  // Get max position
  const [maxPos] = await db
    .select({ max: sql<number>`COALESCE(MAX(${userDatabaseRows.position}), -1)` })
    .from(userDatabaseRows)
    .where(eq(userDatabaseRows.databaseId, databaseId));

  const [row] = await db
    .insert(userDatabaseRows)
    .values({
      databaseId,
      cells: parsed.data.cells ?? {},
      position: (maxPos?.max ?? -1) + 1,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}

const updateRowsSchema = z.object({
  rows: z.array(
    z.object({
      id: z.string().uuid(),
      cells: z.record(z.string(), z.any()),
    })
  ),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ databaseId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { databaseId } = await params;
  const { database, allowed } = await getDatabaseWithAccess(databaseId, user.id);
  if (!database) return NextResponse.json({ error: "Base introuvable" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const body = await request.json();
  const parsed = updateRowsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const results = [];
  for (const row of parsed.data.rows) {
    // Merge cells: get existing row, merge with new cells
    const [existing] = await db
      .select()
      .from(userDatabaseRows)
      .where(eq(userDatabaseRows.id, row.id))
      .limit(1);

    if (!existing) continue;

    const mergedCells = {
      ...((existing.cells ?? {}) as Record<string, unknown>),
      ...row.cells,
    };

    const [updated] = await db
      .update(userDatabaseRows)
      .set({ cells: mergedCells, updatedAt: new Date() })
      .where(eq(userDatabaseRows.id, row.id))
      .returning();

    if (updated) results.push(updated);
  }

  return NextResponse.json(results);
}

const deleteRowSchema = z.object({
  rowId: z.string().uuid(),
});

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ databaseId: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { databaseId } = await params;
  const { database, allowed } = await getDatabaseWithAccess(databaseId, user.id);
  if (!database) return NextResponse.json({ error: "Base introuvable" }, { status: 404 });
  if (!allowed) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const body = await request.json();
  const parsed = deleteRowSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  await db
    .delete(userDatabaseRows)
    .where(eq(userDatabaseRows.id, parsed.data.rowId));

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  userDatabases,
  userDatabaseColumns,
  userDatabaseRows,
} from "@/lib/db/schema";
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

const createColumnSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["text", "number", "date", "select", "checkbox", "relation", "image", "formula", "url", "email"]),
  config: z.record(z.string(), z.any()).optional(),
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
  const parsed = createColumnSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  // Get max position
  const [maxPos] = await db
    .select({ max: sql<number>`COALESCE(MAX(${userDatabaseColumns.position}), -1)` })
    .from(userDatabaseColumns)
    .where(eq(userDatabaseColumns.databaseId, databaseId));

  const [column] = await db
    .insert(userDatabaseColumns)
    .values({
      databaseId,
      name: parsed.data.name,
      type: parsed.data.type,
      config: parsed.data.config ?? {},
      position: (maxPos?.max ?? -1) + 1,
    })
    .returning();

  return NextResponse.json(column, { status: 201 });
}

const updateColumnsSchema = z.object({
  columns: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string().min(1).optional(),
      type: z
        .enum(["text", "number", "date", "select", "checkbox", "relation", "image"])
        .optional(),
      config: z.record(z.string(), z.any()).optional(),
      position: z.number().int().min(0).optional(),
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
  const parsed = updateColumnsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const results = [];
  for (const col of parsed.data.columns) {
    const { id, ...updates } = col;
    if (Object.keys(updates).length === 0) continue;

    const [updated] = await db
      .update(userDatabaseColumns)
      .set(updates)
      .where(eq(userDatabaseColumns.id, id))
      .returning();
    if (updated) results.push(updated);
  }

  return NextResponse.json(results);
}

const deleteColumnSchema = z.object({
  columnId: z.string().uuid(),
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
  const parsed = deleteColumnSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  // Delete column
  await db
    .delete(userDatabaseColumns)
    .where(eq(userDatabaseColumns.id, parsed.data.columnId));

  // Clean up cells in all rows: remove the deleted column's key from JSONB
  const rows = await db
    .select()
    .from(userDatabaseRows)
    .where(eq(userDatabaseRows.databaseId, databaseId));

  for (const row of rows) {
    const cells = (row.cells ?? {}) as Record<string, unknown>;
    if (parsed.data.columnId in cells) {
      delete cells[parsed.data.columnId];
      await db
        .update(userDatabaseRows)
        .set({ cells })
        .where(eq(userDatabaseRows.id, row.id));
    }
  }

  return NextResponse.json({ ok: true });
}

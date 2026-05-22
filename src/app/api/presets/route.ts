import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-user";
import { db } from "@/lib/db";
import { sharedPresets, users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

// GET — list all shared presets (with author name)
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const presets = await db
    .select({
      id: sharedPresets.id,
      name: sharedPresets.name,
      description: sharedPresets.description,
      config: sharedPresets.config,
      createdAt: sharedPresets.createdAt,
      userId: sharedPresets.userId,
      authorName: users.name,
    })
    .from(sharedPresets)
    .innerJoin(users, eq(sharedPresets.userId, users.id))
    .orderBy(desc(sharedPresets.createdAt));

  return NextResponse.json(presets);
}

// POST — share a preset
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await req.json();
  const { name, description, config } = body;

  if (!name || !config) {
    return NextResponse.json({ error: "Nom et configuration requis" }, { status: 400 });
  }

  const [preset] = await db
    .insert(sharedPresets)
    .values({
      userId: user.id,
      name,
      description: description || null,
      config,
    })
    .returning();

  return NextResponse.json(preset, { status: 201 });
}

// DELETE — remove own shared preset
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: "ID requis" }, { status: 400 });
  }

  // Only allow deleting own presets (or admin)
  const [existing] = await db
    .select({ userId: sharedPresets.userId })
    .from(sharedPresets)
    .where(eq(sharedPresets.id, id));

  if (!existing) {
    return NextResponse.json({ error: "Preset introuvable" }, { status: 404 });
  }

  if (existing.userId !== user.id && user.globalRole !== "super_admin" && user.globalRole !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  await db.delete(sharedPresets).where(eq(sharedPresets.id, id));

  return NextResponse.json({ success: true });
}

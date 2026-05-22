import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { labels } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";
import { z } from "zod";

// GET /api/labels — retourne tous les labels globaux
export async function GET(_request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const result = await db
    .select()
    .from(labels)
    .where(eq(labels.isGlobal, true))
    .orderBy(labels.name);

  return NextResponse.json(result);
}

const createLabelSchema = z.object({
  name: z.string().min(1).max(64),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide (format attendu : #RRGGBB)"),
  isGlobal: z.literal(true),
});

// POST /api/labels — crée un label global (admin uniquement)
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  if (!hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createLabelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const [label] = await db
    .insert(labels)
    .values({
      name: parsed.data.name,
      color: parsed.data.color,
      isGlobal: true,
      spaceId: null,
      createdBy: user.id,
    })
    .returning();

  return NextResponse.json(label, { status: 201 });
}

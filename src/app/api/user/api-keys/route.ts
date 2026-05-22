import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { generateApiKey, API_KEY_SCOPES } from "@/lib/auth/api-key";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(255),
  scopes: z.array(z.enum(API_KEY_SCOPES as unknown as [string, ...string[]])).min(1),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

/**
 * GET /api/user/api-keys — List user's API keys (sans le secret).
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const keys = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      scopes: apiKeys.scopes,
      lastUsedAt: apiKeys.lastUsedAt,
      revokedAt: apiKeys.revokedAt,
      expiresAt: apiKeys.expiresAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, user.id), isNull(apiKeys.revokedAt)))
    .orderBy(apiKeys.createdAt);

  return NextResponse.json(keys);
}

/**
 * POST /api/user/api-keys — Create a new API key.
 * Returns the full key ONCE in the response.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, scopes, expiresInDays } = parsed.data;

  // Limit: 20 active keys per user
  const activeCount = await db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, user.id), isNull(apiKeys.revokedAt)));

  if (activeCount.length >= 20) {
    return NextResponse.json(
      { error: "Limite de 20 clés API actives atteinte" },
      { status: 400 }
    );
  }

  const { fullKey, keyHash, keyPrefix } = generateApiKey();
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const [created] = await db
    .insert(apiKeys)
    .values({
      userId: user.id,
      name,
      keyHash,
      keyPrefix,
      scopes,
      expiresAt,
    })
    .returning({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      scopes: apiKeys.scopes,
      expiresAt: apiKeys.expiresAt,
      createdAt: apiKeys.createdAt,
    });

  return NextResponse.json({
    ...created,
    key: fullKey, // Affiché une seule fois
  });
}

/**
 * DELETE /api/user/api-keys — Revoke an API key.
 */
export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const keyId = searchParams.get("id");
  if (!keyId) {
    return NextResponse.json({ error: "ID requis" }, { status: 400 });
  }

  const [updated] = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, user.id)))
    .returning({ id: apiKeys.id });

  if (!updated) {
    return NextResponse.json({ error: "Clé introuvable" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

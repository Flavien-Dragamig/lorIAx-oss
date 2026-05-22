import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";
import { apiKeys, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const KEY_PREFIX = "lrx_";

export const API_KEY_SCOPES = [
  "documents:read",
  "documents:write",
  "spaces:read",
  "spaces:write",
  "search",
  "webhooks",
  "calendars:read",
  "calendars:write",
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

/**
 * Generate a new API key.
 * Returns the full key (shown once) and the hash/prefix for storage.
 */
export function generateApiKey(): {
  fullKey: string;
  keyHash: string;
  keyPrefix: string;
} {
  const rawBytes = randomBytes(32);
  const rawKey = rawBytes.toString("base64url");
  const fullKey = `${KEY_PREFIX}${rawKey}`;
  const keyHash = createHash("sha256").update(fullKey).digest("hex");
  const keyPrefix = fullKey.substring(0, KEY_PREFIX.length + 8);

  return { fullKey, keyHash, keyPrefix };
}

/**
 * Hash an API key for lookup.
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Resolve an API key to a user + scopes.
 * Returns null if the key is invalid, revoked, or expired.
 */
export async function resolveApiKey(key: string): Promise<{
  userId: string;
  email: string;
  name: string;
  globalRole: string; // DB enum retourne string, narrowing fait côté consommateur
  scopes: ApiKeyScope[];
  keyId: string;
} | null> {
  if (!key.startsWith(KEY_PREFIX)) return null;

  const hash = hashApiKey(key);

  const result = await db
    .select({
      keyId: apiKeys.id,
      userId: apiKeys.userId,
      scopes: apiKeys.scopes,
      revokedAt: apiKeys.revokedAt,
      expiresAt: apiKeys.expiresAt,
      email: users.email,
      name: users.name,
      globalRole: users.globalRole,
    })
    .from(apiKeys)
    .innerJoin(users, eq(apiKeys.userId, users.id))
    .where(eq(apiKeys.keyHash, hash))
    .limit(1);

  if (result.length === 0) return null;

  const row = result[0];

  // Check revoked
  if (row.revokedAt) return null;

  // Check expired
  if (row.expiresAt && new Date(row.expiresAt) < new Date()) return null;

  // Update lastUsedAt (non-blocking)
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.keyId))
    .catch(() => {});

  return {
    userId: row.userId,
    email: row.email,
    name: row.name,
    globalRole: row.globalRole,
    scopes: (row.scopes as ApiKeyScope[]) || [],
    keyId: row.keyId,
  };
}

/**
 * Check if a resolved API key has a required scope.
 */
export function hasScope(
  scopes: ApiKeyScope[],
  required: ApiKeyScope
): boolean {
  return scopes.includes(required);
}

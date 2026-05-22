import { resolveApiKey, hasScope, type ApiKeyScope } from "@/lib/auth/api-key";
import { getSessionUser } from "@/lib/auth/get-user";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { apiError } from "./response";
import type { UserRole } from "@/types";

export interface ApiUser {
  id: string;
  email: string;
  name: string;
  globalRole: UserRole;
  scopes: ApiKeyScope[] | null; // null = session auth (all scopes)
  keyId?: string;
}

/**
 * Authenticate an API v1 request.
 * Supports both API key (Authorization: Bearer lrx_...) and session auth.
 */
export async function authenticateApiRequest(
  request: Request
): Promise<{ user: ApiUser } | { error: ReturnType<typeof apiError> }> {
  const authHeader = request.headers.get("authorization");

  // API key auth
  if (authHeader?.startsWith("Bearer lrx_")) {
    const key = authHeader.substring(7);
    const resolved = await resolveApiKey(key);

    if (!resolved) {
      return { error: apiError("Clé API invalide ou expirée", 401) };
    }

    // Rate limit per API key
    const _ip = getClientIp(request);
    const rl = checkRateLimit(
      `api:${resolved.keyId}`,
      { maxRequests: 100, windowMs: 60_000 }
    );
    if (!rl.success) {
      return { error: apiError("Limite de requêtes dépassée", 429) };
    }

    return {
      user: {
        id: resolved.userId,
        email: resolved.email,
        name: resolved.name,
        globalRole: resolved.globalRole as UserRole,
        scopes: resolved.scopes,
        keyId: resolved.keyId,
      },
    };
  }

  // Session auth fallback
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return { error: apiError("Non autorisé", 401) };
  }

  return {
    user: {
      id: sessionUser.id,
      email: sessionUser.email!,
      name: sessionUser.name!,
      globalRole: sessionUser.globalRole,
      scopes: null, // Session = all scopes
    },
  };
}

/**
 * Check if the authenticated user has a required scope.
 * Session users always pass (scopes = null).
 */
export function requireScope(
  user: ApiUser,
  scope: ApiKeyScope
): ReturnType<typeof apiError> | null {
  if (user.scopes === null) return null; // Session auth
  if (hasScope(user.scopes, scope)) return null;
  return apiError(`Scope manquant : ${scope}`, 403);
}

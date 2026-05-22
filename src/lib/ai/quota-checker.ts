import { db } from "@/lib/db";
import { aiQuotas, aiUsageLogs } from "@/lib/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  quotaScope?: "org" | "team" | "user";
  usage?: { tokens: number; requests: number };
  limit?: { maxTokens: number | null; maxRequests: number | null };
}

/**
 * Compute the start of the current period for a given quota period type.
 */
function periodStart(period: "daily" | "monthly"): Date {
  const now = new Date();
  if (period === "daily") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  // monthly — first day of current month
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * Check whether a user is within their AI quota.
 *
 * Resolution hierarchy (most specific wins):
 *   1. User-level quota  (scope="user", scopeId=userId)
 *   2. Team-level quota  (scope="team", scopeId=teamId)
 *   3. Org-level quota   (scope="org")
 *   4. No quota found → allowed
 */
export async function checkQuota(
  userId: string,
  teamId?: string,
): Promise<QuotaCheckResult> {
  // --- 1. Resolve the applicable quota (most specific first) ---
  const quota = await resolveQuota(userId, teamId);

  if (!quota) {
    return { allowed: true };
  }

  // Neither limit is set — allow
  if (quota.maxTokens === null && quota.maxRequests === null) {
    return { allowed: true, quotaScope: quota.scope };
  }

  // --- 2. Compute current usage for the period ---
  const start = periodStart(quota.period);
  const usage = await computeUsage(userId, start);

  const limit = {
    maxTokens: quota.maxTokens,
    maxRequests: quota.maxRequests,
  };

  // --- 3. Check limits ---
  if (limit.maxTokens !== null && usage.tokens >= limit.maxTokens) {
    return {
      allowed: false,
      reason: `Quota de tokens atteint (${usage.tokens}/${limit.maxTokens})`,
      quotaScope: quota.scope,
      usage,
      limit,
    };
  }

  if (limit.maxRequests !== null && usage.requests >= limit.maxRequests) {
    return {
      allowed: false,
      reason: `Quota de requêtes atteint (${usage.requests}/${limit.maxRequests})`,
      quotaScope: quota.scope,
      usage,
      limit,
    };
  }

  return {
    allowed: true,
    quotaScope: quota.scope,
    usage,
    limit,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface ResolvedQuota {
  scope: "org" | "team" | "user";
  period: "daily" | "monthly";
  maxTokens: number | null;
  maxRequests: number | null;
}

async function resolveQuota(
  userId: string,
  teamId?: string,
): Promise<ResolvedQuota | null> {
  // User-level
  const [userQuota] = await db
    .select()
    .from(aiQuotas)
    .where(and(eq(aiQuotas.scope, "user"), eq(aiQuotas.scopeId, userId)))
    .limit(1);

  if (userQuota) {
    return {
      scope: "user",
      period: userQuota.period,
      maxTokens: userQuota.maxTokens,
      maxRequests: userQuota.maxRequests,
    };
  }

  // Team-level
  if (teamId) {
    const [teamQuota] = await db
      .select()
      .from(aiQuotas)
      .where(and(eq(aiQuotas.scope, "team"), eq(aiQuotas.scopeId, teamId)))
      .limit(1);

    if (teamQuota) {
      return {
        scope: "team",
        period: teamQuota.period,
        maxTokens: teamQuota.maxTokens,
        maxRequests: teamQuota.maxRequests,
      };
    }
  }

  // Org-level (scopeId is null for org-wide quotas)
  const [orgQuota] = await db
    .select()
    .from(aiQuotas)
    .where(eq(aiQuotas.scope, "org"))
    .limit(1);

  if (orgQuota) {
    return {
      scope: "org",
      period: orgQuota.period,
      maxTokens: orgQuota.maxTokens,
      maxRequests: orgQuota.maxRequests,
    };
  }

  return null;
}

async function computeUsage(
  userId: string,
  since: Date,
): Promise<{ tokens: number; requests: number }> {
  const [result] = await db
    .select({
      tokens: sql<number>`coalesce(sum(coalesce(${aiUsageLogs.tokensIn}, 0) + coalesce(${aiUsageLogs.tokensOut}, 0)), 0)`,
      requests: sql<number>`count(*)`,
    })
    .from(aiUsageLogs)
    .where(
      and(
        eq(aiUsageLogs.userId, userId),
        gte(aiUsageLogs.createdAt, since),
      ),
    );

  return {
    tokens: Number(result?.tokens ?? 0),
    requests: Number(result?.requests ?? 0),
  };
}

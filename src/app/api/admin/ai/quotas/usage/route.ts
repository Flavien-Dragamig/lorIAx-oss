import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { aiUsageLogs } from "@/lib/db/schema-ai";
import { teamMembers } from "@/lib/db/schema";
import { sql, gte, eq, and, inArray, count } from "drizzle-orm";

function getPeriodStart(period: "daily" | "monthly"): Date {
  const now = new Date();
  if (period === "daily") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start;
  }
  // monthly
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") || "org";
  const scopeId = searchParams.get("scopeId");
  const period = (searchParams.get("period") as "daily" | "monthly") || "monthly";

  if (!["org", "team", "user"].includes(scope)) {
    return NextResponse.json({ error: "Scope invalide" }, { status: 400 });
  }

  if (scope !== "org" && !scopeId) {
    return NextResponse.json(
      { error: "scopeId requis pour les scopes team/user" },
      { status: 400 }
    );
  }

  try {
    const periodStart = getPeriodStart(period);

    const conditions = [gte(aiUsageLogs.createdAt, periodStart)];

    if (scope === "user" && scopeId) {
      conditions.push(eq(aiUsageLogs.userId, scopeId));
    } else if (scope === "team" && scopeId) {
      // Aggregate all team members' usage
      const members = await db
        .select({ userId: teamMembers.userId })
        .from(teamMembers)
        .where(eq(teamMembers.teamId, scopeId));

      const memberIds = members.map((m) => m.userId);

      if (memberIds.length === 0) {
        return NextResponse.json({
          tokens: 0,
          requests: 0,
          periodStart: periodStart.toISOString(),
        });
      }

      conditions.push(inArray(aiUsageLogs.userId, memberIds));
    }
    // scope === "org" → no additional filter, aggregate everything

    const [stats] = await db
      .select({
        tokens: sql<number>`coalesce(sum(coalesce(${aiUsageLogs.tokensIn}, 0) + coalesce(${aiUsageLogs.tokensOut}, 0)), 0)::int`,
        requests: count(),
      })
      .from(aiUsageLogs)
      .where(and(...conditions));

    return NextResponse.json({
      tokens: stats?.tokens ?? 0,
      requests: stats?.requests ?? 0,
      periodStart: periodStart.toISOString(),
    });
  } catch (error) {
    console.error("Quotas usage GET error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération de la consommation" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { aiUsageLogs } from "@/lib/db/schema-ai";
import { aiProviders } from "@/lib/db/schema";
import { sql, gte, and, lt, eq, count } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "24h";

  // Calculate date boundaries
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let periodStart: Date;
  switch (period) {
    case "7d":
      periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default: // 24h
      periodStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  try {
    // --- KPI ---
    // Requests today
    const [todayStats] = await db
      .select({
        count: count(),
        tokensIn: sql<number>`coalesce(sum(${aiUsageLogs.tokensIn}), 0)::int`,
        tokensOut: sql<number>`coalesce(sum(${aiUsageLogs.tokensOut}), 0)::int`,
        avgLatency: sql<number>`coalesce(avg(${aiUsageLogs.latencyMs}), 0)::int`,
        errorCount: sql<number>`count(*) filter (where ${aiUsageLogs.status} != 'success')::int`,
        costToday: sql<string>`coalesce(sum(${aiUsageLogs.costEstimate}), 0)::text`,
      })
      .from(aiUsageLogs)
      .where(gte(aiUsageLogs.createdAt, todayStart));

    // Requests yesterday (for trend)
    const [yesterdayStats] = await db
      .select({ count: count() })
      .from(aiUsageLogs)
      .where(
        and(
          gte(aiUsageLogs.createdAt, yesterdayStart),
          lt(aiUsageLogs.createdAt, todayStart)
        )
      );

    // Cost this month
    const [monthStats] = await db
      .select({
        costMonth: sql<string>`coalesce(sum(${aiUsageLogs.costEstimate}), 0)::text`,
      })
      .from(aiUsageLogs)
      .where(gte(aiUsageLogs.createdAt, monthStart));

    const requestsToday = todayStats?.count ?? 0;
    const requestsYesterday = yesterdayStats?.count ?? 0;
    const errorRate =
      requestsToday > 0
        ? ((todayStats?.errorCount ?? 0) / requestsToday) * 100
        : 0;

    const kpi = {
      requestsToday,
      requestsYesterday,
      tokensIn: todayStats?.tokensIn ?? 0,
      tokensOut: todayStats?.tokensOut ?? 0,
      avgLatency: todayStats?.avgLatency ?? 0,
      errorRate: Math.round(errorRate * 100) / 100,
      costToday: parseFloat(todayStats?.costToday ?? "0"),
      costMonth: parseFloat(monthStats?.costMonth ?? "0"),
    };

    // --- Time series ---
    const bucketExpr =
      period === "24h"
        ? sql`date_trunc('hour', ${aiUsageLogs.createdAt})`
        : sql`date_trunc('day', ${aiUsageLogs.createdAt})`;

    const timeSeries = await db
      .select({
        bucket: sql<string>`${bucketExpr}::text`.as("bucket"),
        requests: count(),
        tokensTotal: sql<number>`coalesce(sum(coalesce(${aiUsageLogs.tokensIn}, 0) + coalesce(${aiUsageLogs.tokensOut}, 0)), 0)::int`,
      })
      .from(aiUsageLogs)
      .where(gte(aiUsageLogs.createdAt, periodStart))
      .groupBy(sql`${bucketExpr}`)
      .orderBy(sql`${bucketExpr}`);

    // --- By usage type ---
    const byUsage = await db
      .select({
        usageType: aiUsageLogs.usageType,
        count: count(),
      })
      .from(aiUsageLogs)
      .where(gte(aiUsageLogs.createdAt, periodStart))
      .groupBy(aiUsageLogs.usageType);

    // --- By provider ---
    const byProvider = await db
      .select({
        providerId: aiUsageLogs.providerId,
        count: count(),
        displayName: aiProviders.displayName,
        color: aiProviders.color,
      })
      .from(aiUsageLogs)
      .leftJoin(aiProviders, eq(aiUsageLogs.providerId, aiProviders.id))
      .where(gte(aiUsageLogs.createdAt, periodStart))
      .groupBy(aiUsageLogs.providerId, aiProviders.displayName, aiProviders.color);

    return NextResponse.json({
      kpi,
      timeSeries,
      byUsage,
      byProvider: byProvider.map((p) => ({
        ...p,
        displayName: p.displayName ?? "Inconnu",
        color: p.color ?? "#94a3b8",
      })),
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des données" },
      { status: 500 }
    );
  }
}

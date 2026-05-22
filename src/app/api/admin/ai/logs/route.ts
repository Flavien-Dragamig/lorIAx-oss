import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { aiUsageLogs, aiUsageTypeEnum, aiLogStatusEnum } from "@/lib/db/schema-ai";
import { users, aiProviders } from "@/lib/db/schema";
import { eq, gte, lte, and, count, asc, desc, inArray } from "drizzle-orm";
import type { AnyColumn } from "drizzle-orm";

type AiUsageType = (typeof aiUsageTypeEnum.enumValues)[number];
type AiLogStatus = (typeof aiLogStatusEnum.enumValues)[number];

const SORTABLE_COLUMNS: Record<string, AnyColumn> = {
  createdAt: aiUsageLogs.createdAt,
  tokensIn: aiUsageLogs.tokensIn,
  tokensOut: aiUsageLogs.tokensOut,
  latencyMs: aiUsageLogs.latencyMs,
  costEstimate: aiUsageLogs.costEstimate,
  status: aiUsageLogs.status,
  usageType: aiUsageLogs.usageType,
  model: aiUsageLogs.model,
};

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);

  // Pagination
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
  const offset = (page - 1) * limit;

  // Filters
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const userId = searchParams.get("userId");
  const teamId = searchParams.get("teamId");
  const usageType = searchParams.get("usageType");
  const providerId = searchParams.get("providerId");
  const status = searchParams.get("status");

  // Sort
  const sortParam = searchParams.get("sort") || "createdAt";
  const orderParam = searchParams.get("order") || "desc";
  const sortColumn = SORTABLE_COLUMNS[sortParam] ?? aiUsageLogs.createdAt;
  const orderFn = orderParam === "asc" ? asc : desc;

  // Build conditions
  const conditions = [];
  if (from) {
    conditions.push(gte(aiUsageLogs.createdAt, new Date(from)));
  }
  if (to) {
    // End of day
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    conditions.push(lte(aiUsageLogs.createdAt, toDate));
  }
  if (userId) {
    conditions.push(eq(aiUsageLogs.userId, userId));
  }
  if (teamId) {
    conditions.push(eq(aiUsageLogs.teamId, teamId));
  }
  if (usageType) {
    // Support multi-select (comma-separated)
    const types = usageType.split(",").filter(Boolean) as AiUsageType[];
    if (types.length === 1) {
      conditions.push(eq(aiUsageLogs.usageType, types[0]));
    } else if (types.length > 1) {
      conditions.push(inArray(aiUsageLogs.usageType, types));
    }
  }
  if (providerId) {
    const providers = providerId.split(",").filter(Boolean);
    if (providers.length === 1) {
      conditions.push(eq(aiUsageLogs.providerId, providers[0]));
    } else if (providers.length > 1) {
      conditions.push(inArray(aiUsageLogs.providerId, providers));
    }
  }
  if (status) {
    const statuses = status.split(",").filter(Boolean) as AiLogStatus[];
    if (statuses.length === 1) {
      conditions.push(eq(aiUsageLogs.status, statuses[0]));
    } else if (statuses.length > 1) {
      conditions.push(inArray(aiUsageLogs.status, statuses));
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  try {
    // Count total
    const [{ total }] = await db
      .select({ total: count() })
      .from(aiUsageLogs)
      .where(whereClause);

    // Fetch logs with user info
    const logs = await db
      .select({
        id: aiUsageLogs.id,
        userId: aiUsageLogs.userId,
        userName: users.name,
        userEmail: users.email,
        teamId: aiUsageLogs.teamId,
        providerId: aiUsageLogs.providerId,
        providerName: aiProviders.displayName,
        providerColor: aiProviders.color,
        model: aiUsageLogs.model,
        usageType: aiUsageLogs.usageType,
        tokensIn: aiUsageLogs.tokensIn,
        tokensOut: aiUsageLogs.tokensOut,
        latencyMs: aiUsageLogs.latencyMs,
        status: aiUsageLogs.status,
        errorMessage: aiUsageLogs.errorMessage,
        costEstimate: aiUsageLogs.costEstimate,
        createdAt: aiUsageLogs.createdAt,
      })
      .from(aiUsageLogs)
      .leftJoin(users, eq(aiUsageLogs.userId, users.id))
      .leftJoin(aiProviders, eq(aiUsageLogs.providerId, aiProviders.id))
      .where(whereClause)
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Logs API error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des logs" },
      { status: 500 }
    );
  }
}

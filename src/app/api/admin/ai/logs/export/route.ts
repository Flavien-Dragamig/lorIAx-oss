import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { aiUsageLogs } from "@/lib/db/schema-ai";
import { users, aiProviders } from "@/lib/db/schema";
import { sql, eq, gte, lte, and, desc } from "drizzle-orm";

const MAX_EXPORT_ROWS = 10000;

const USAGE_TYPE_LABELS: Record<string, string> = {
  chat: "Chat",
  summary_doc: "Résumé doc",
  summary_meeting: "Résumé réunion",
  embeddings: "Embeddings",
  playground: "Playground",
};

const STATUS_LABELS: Record<string, string> = {
  success: "Succès",
  error: "Erreur",
  timeout: "Timeout",
  fallback: "Fallback",
  quota_exceeded: "Quota dépassé",
};

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);

  // Filters (same as list endpoint)
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const userId = searchParams.get("userId");
  const teamId = searchParams.get("teamId");
  const usageType = searchParams.get("usageType");
  const providerId = searchParams.get("providerId");
  const status = searchParams.get("status");

  const conditions = [];
  if (from) {
    conditions.push(gte(aiUsageLogs.createdAt, new Date(from)));
  }
  if (to) {
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
    const types = usageType.split(",").filter(Boolean);
    if (types.length === 1) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conditions.push(eq(aiUsageLogs.usageType, types[0] as any));
    } else if (types.length > 1) {
      conditions.push(sql`${aiUsageLogs.usageType}::text = ANY(${types})`);
    }
  }
  if (providerId) {
    const providers = providerId.split(",").filter(Boolean);
    if (providers.length === 1) {
      conditions.push(eq(aiUsageLogs.providerId, providers[0]));
    } else if (providers.length > 1) {
      conditions.push(sql`${aiUsageLogs.providerId}::text = ANY(${providers})`);
    }
  }
  if (status) {
    const statuses = status.split(",").filter(Boolean);
    if (statuses.length === 1) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conditions.push(eq(aiUsageLogs.status, statuses[0] as any));
    } else if (statuses.length > 1) {
      conditions.push(sql`${aiUsageLogs.status}::text = ANY(${statuses})`);
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  try {
    const rows = await db
      .select({
        createdAt: aiUsageLogs.createdAt,
        userName: users.name,
        userEmail: users.email,
        teamId: aiUsageLogs.teamId,
        usageType: aiUsageLogs.usageType,
        providerName: aiProviders.displayName,
        model: aiUsageLogs.model,
        tokensIn: aiUsageLogs.tokensIn,
        tokensOut: aiUsageLogs.tokensOut,
        latencyMs: aiUsageLogs.latencyMs,
        costEstimate: aiUsageLogs.costEstimate,
        status: aiUsageLogs.status,
      })
      .from(aiUsageLogs)
      .leftJoin(users, eq(aiUsageLogs.userId, users.id))
      .leftJoin(aiProviders, eq(aiUsageLogs.providerId, aiProviders.id))
      .where(whereClause)
      .orderBy(desc(aiUsageLogs.createdAt))
      .limit(MAX_EXPORT_ROWS);

    // Build CSV
    const BOM = "\uFEFF";
    const header = "date,utilisateur,email,equipe,usage,provider,modele,tokens_in,tokens_out,latence_ms,cout_estime,statut";
    const csvRows = rows.map((r) => {
      const date = r.createdAt
        ? new Date(r.createdAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })
        : "";
      return [
        escapeCsvField(date),
        escapeCsvField(r.userName ?? ""),
        escapeCsvField(r.userEmail ?? ""),
        r.teamId ?? "",
        escapeCsvField(USAGE_TYPE_LABELS[r.usageType] ?? r.usageType),
        escapeCsvField(r.providerName ?? ""),
        escapeCsvField(r.model ?? ""),
        r.tokensIn ?? "",
        r.tokensOut ?? "",
        r.latencyMs ?? "",
        r.costEstimate ?? "",
        escapeCsvField(STATUS_LABELS[r.status] ?? r.status),
      ].join(",");
    });

    const csv = BOM + header + "\n" + csvRows.join("\n");

    const now = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="loriax-ai-logs-${now}.csv"`,
      },
    });
  } catch (error) {
    console.error("Logs export error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'export des logs" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { aiUsageLogs } from "@/lib/db/schema-ai";
import { users, aiProviders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const [log] = await db
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
        fallbackProviderId: aiUsageLogs.fallbackProviderId,
        promptVersionId: aiUsageLogs.promptVersionId,
        costEstimate: aiUsageLogs.costEstimate,
        requestBody: aiUsageLogs.requestBody,
        responseBody: aiUsageLogs.responseBody,
        createdAt: aiUsageLogs.createdAt,
      })
      .from(aiUsageLogs)
      .leftJoin(users, eq(aiUsageLogs.userId, users.id))
      .leftJoin(aiProviders, eq(aiUsageLogs.providerId, aiProviders.id))
      .where(eq(aiUsageLogs.id, id));

    if (!log) {
      return NextResponse.json({ error: "Log introuvable" }, { status: 404 });
    }

    return NextResponse.json(log);
  } catch (error) {
    console.error("Log detail API error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du log" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { aiQuotas } from "@/lib/db/schema-ai";
import { eq } from "drizzle-orm";

export async function GET() {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  try {
    const quotas = await db.select().from(aiQuotas).orderBy(aiQuotas.scope);
    return NextResponse.json(quotas);
  } catch (error) {
    console.error("Quotas GET error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des quotas" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { scope, scopeId, period, maxTokens, maxRequests } = body;

    if (!scope || !["org", "team", "user"].includes(scope)) {
      return NextResponse.json({ error: "Scope invalide" }, { status: 400 });
    }

    if (scope !== "org" && !scopeId) {
      return NextResponse.json(
        { error: "scopeId requis pour les quotas team/user" },
        { status: 400 }
      );
    }

    const [quota] = await db
      .insert(aiQuotas)
      .values({
        scope,
        scopeId: scope === "org" ? null : scopeId,
        period: period || "monthly",
        maxTokens: maxTokens ?? null,
        maxRequests: maxRequests ?? null,
      })
      .returning();

    return NextResponse.json(quota, { status: 201 });
  } catch (error) {
    console.error("Quotas POST error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création du quota" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, maxTokens, maxRequests, period } = body;

    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (maxTokens !== undefined) updates.maxTokens = maxTokens;
    if (maxRequests !== undefined) updates.maxRequests = maxRequests;
    if (period !== undefined) updates.period = period;

    const [updated] = await db
      .update(aiQuotas)
      .set(updates)
      .where(eq(aiQuotas.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Quota introuvable" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Quotas PATCH error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du quota" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }

    const [deleted] = await db
      .delete(aiQuotas)
      .where(eq(aiQuotas.id, id))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Quota introuvable" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Quotas DELETE error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du quota" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema-org";
import { eq } from "drizzle-orm";
import { getPlanLimits, resolvePlanId } from "@/lib/billing/plans";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const secret = process.env.INTERNAL_API_SECRET;

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { orgSlug, plan } = (await req.json()) as { orgSlug: string; plan: string };
  if (!orgSlug || !plan) {
    return NextResponse.json({ error: "orgSlug et plan requis" }, { status: 400 });
  }

  const validPlan = resolvePlanId(plan);
  const limits = getPlanLimits(validPlan);

  await db
    .update(organizations)
    .set({
      plan: validPlan,
      maxUsers: limits.maxUsers ?? 9999,
      maxSpaces: limits.maxSpaces ?? 9999,
      maxStorageGb: String(limits.maxStorageGB),
      updatedAt: new Date(),
    })
    .where(eq(organizations.slug, orgSlug));

  return NextResponse.json({ ok: true });
}

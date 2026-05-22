import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { imageProviders } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";
import { encrypt } from "@/lib/crypto";
import { headers } from "next/headers";
import { getOrgId, getOrgSlugFromHeaders } from "@/lib/org/get-org-id";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin"))
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const orgSlug = await getOrgSlugFromHeaders(headers);
  const orgId = await getOrgId(orgSlug);
  const { id } = await params;
  const body = await req.json();

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.isEnabled === "boolean") updates.isEnabled = body.isEnabled;
  if (body.apiKey) updates.apiKeyEnc = encrypt(body.apiKey);
  if (body.displayName) updates.displayName = body.displayName;

  const [row] = await db
    .update(imageProviders)
    .set(updates)
    .where(and(eq(imageProviders.id, id), eq(imageProviders.organizationId, orgId)))
    .returning({
      id: imageProviders.id,
      name: imageProviders.name,
      isEnabled: imageProviders.isEnabled,
    });

  if (!row) return NextResponse.json({ error: "Provider introuvable" }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin"))
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const orgSlug = await getOrgSlugFromHeaders(headers);
  const orgId = await getOrgId(orgSlug);
  const { id } = await params;

  await db
    .delete(imageProviders)
    .where(and(eq(imageProviders.id, id), eq(imageProviders.organizationId, orgId)));

  return new NextResponse(null, { status: 204 });
}

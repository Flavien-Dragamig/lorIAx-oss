import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { imageProviders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";
import { encrypt } from "@/lib/crypto";
import { headers } from "next/headers";
import { getOrgId, getOrgSlugFromHeaders } from "@/lib/org/get-org-id";

export async function GET() {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin"))
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const orgSlug = await getOrgSlugFromHeaders(headers);
  const orgId = await getOrgId(orgSlug);

  const providers = await db
    .select({
      id: imageProviders.id,
      name: imageProviders.name,
      displayName: imageProviders.displayName,
      providerType: imageProviders.providerType,
      isEnabled: imageProviders.isEnabled,
      hasApiKey: imageProviders.apiKeyEnc,
      createdAt: imageProviders.createdAt,
    })
    .from(imageProviders)
    .where(eq(imageProviders.organizationId, orgId));

  return NextResponse.json(
    providers.map((p) => ({ ...p, hasApiKey: !!p.hasApiKey }))
  );
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin"))
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const orgSlug = await getOrgSlugFromHeaders(headers);
  const orgId = await getOrgId(orgSlug);

  const { name, displayName, providerType, baseUrl, apiKey } = await req.json();
  if (!name || !displayName || !providerType)
    return NextResponse.json({ error: "name, displayName et providerType requis" }, { status: 400 });

  const [row] = await db
    .insert(imageProviders)
    .values({
      name,
      displayName,
      providerType,
      baseUrl: baseUrl || null,
      apiKeyEnc: apiKey ? encrypt(apiKey) : null,
      isEnabled: false,
      organizationId: orgId,
    })
    .returning({
      id: imageProviders.id,
      name: imageProviders.name,
      displayName: imageProviders.displayName,
      providerType: imageProviders.providerType,
      isEnabled: imageProviders.isEnabled,
    });

  return NextResponse.json(row, { status: 201 });
}

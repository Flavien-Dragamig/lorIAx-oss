import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aiProviders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";
import { encrypt } from "@/lib/crypto";

export async function GET() {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const providers = await db
    .select({
      id: aiProviders.id,
      name: aiProviders.name,
      displayName: aiProviders.displayName,
      connectorType: aiProviders.connectorType,
      apiBaseUrl: aiProviders.apiBaseUrl,
      defaultModel: aiProviders.defaultModel,
      isEnabled: aiProviders.isEnabled,
      isDefault: aiProviders.isDefault,
      pricing: aiProviders.pricing,
      icon: aiProviders.icon,
      color: aiProviders.color,
      config: aiProviders.config,
      createdAt: aiProviders.createdAt,
    })
    .from(aiProviders)
    .orderBy(aiProviders.displayName);

  return NextResponse.json(providers);
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json();
  const {
    name,
    displayName,
    connectorType,
    apiBaseUrl,
    apiKeyEnc,
    defaultModel,
    pricing,
    icon,
    color,
    config,
  } = body;

  if (!name || !displayName) {
    return NextResponse.json(
      { error: "Nom et nom d'affichage requis" },
      { status: 400 }
    );
  }

  const [provider] = await db
    .insert(aiProviders)
    .values({
      name,
      displayName,
      connectorType: connectorType || "openai_compatible",
      apiBaseUrl: apiBaseUrl || null,
      apiKeyEnc: apiKeyEnc ? encrypt(apiKeyEnc) : null,
      defaultModel: defaultModel || null,
      pricing: pricing || null,
      icon: icon || null,
      color: color || null,
      config: config || {},
    })
    .returning();

  return NextResponse.json(provider, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "ID requis" }, { status: 400 });
  }

  // Chiffrer la clé API si fournie
  if (updates.apiKeyEnc) {
    updates.apiKeyEnc = encrypt(updates.apiKeyEnc);
  }

  // Si on active "isDefault", désactiver les autres
  if (updates.isDefault) {
    await db
      .update(aiProviders)
      .set({ isDefault: false })
      .where(eq(aiProviders.isDefault, true));
  }

  await db.update(aiProviders).set(updates).where(eq(aiProviders.id, id));

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "ID requis" }, { status: 400 });
  }

  await db.delete(aiProviders).where(eq(aiProviders.id, id));

  return NextResponse.json({ success: true });
}

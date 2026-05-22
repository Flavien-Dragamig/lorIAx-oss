/**
 * POST /api/admin/licenses/generate
 * Génère un JWT de licence — réservé au super_admin uniquement
 */

import { NextRequest, NextResponse } from "next/server";
import * as jose from "jose";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";
import { validateEnv } from "@/lib/env";
import type { Plan, Feature } from "@/lib/license/types";
import { FEATURES_BY_PLAN } from "@/lib/license/constants";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || !hasGlobalRole(user.globalRole, "super_admin")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const env = validateEnv();
    if (!env.LICENSE_PRIVATE_KEY) {
      return NextResponse.json(
        { error: "LICENSE_PRIVATE_KEY non configurée" },
        { status: 501 }
      );
    }

    const body = await req.json();
    const { plan, seats, customerEmail, customerId, durationDays, features } = body;

    if (!plan || !seats || !customerEmail || !customerId || !durationDays) {
      return NextResponse.json({ error: "Champs obligatoires manquants" }, { status: 400 });
    }

    const raw = env.LICENSE_PRIVATE_KEY;
    const pem = raw.includes("-----BEGIN") ? raw : Buffer.from(raw, "base64").toString("utf-8");
    const privateKey = await jose.importPKCS8(pem, "RS256");

    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + Number(durationDays) * 86400;
    const resolvedFeatures: Feature[] = features ?? FEATURES_BY_PLAN[plan as Plan] ?? [];

    const payload = {
      plan,
      seats: Number(seats),
      customerEmail,
      customerId,
      issuedAt: now,
      expiresAt,
      features: resolvedFeatures,
    };

    const jwt = await new jose.SignJWT(payload as unknown as jose.JWTPayload)
      .setProtectedHeader({ alg: "RS256" })
      .setIssuedAt(now)
      .setExpirationTime(expiresAt)
      .sign(privateKey);

    return NextResponse.json({ jwt, payload });
  } catch (err) {
    const error = err as Error;
    console.error("License generation failed:", error);
    return NextResponse.json(
      { error: "Échec de la génération", message: error.message },
      { status: 500 }
    );
  }
}

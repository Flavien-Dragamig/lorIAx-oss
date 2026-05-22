// src/app/api/setup/users/ldap/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { encrypt } from "@/lib/crypto";
import { guardSetupNotCompleted } from "@/lib/setup/guards";
import logger from "@/lib/logger";

interface LdapConfig {
  ldapEnabled: boolean;
  ldapUrl: string;
  ldapBindDn: string;
  ldapBindPassword: string;
  ldapBaseDn: string;
  ldapSearchFilter: string;
  ldapNameAttribute: string;
  ldapEmailAttribute: string;
  ldapRejectUnauthorized: boolean;
}

export async function POST(request: NextRequest) {
  const blocked = await guardSetupNotCompleted();
  if (blocked) return blocked;

  try {
    const body = (await request.json()) as Partial<LdapConfig>;

    if (!body.ldapUrl?.trim()) {
      return NextResponse.json(
        { error: "L'URL du serveur LDAP est obligatoire" },
        { status: 400 }
      );
    }

    if (!body.ldapBaseDn?.trim()) {
      return NextResponse.json(
        { error: "Le Base DN est obligatoire" },
        { status: 400 }
      );
    }

    // Build LDAP settings with defaults
    const ldapSettings: LdapConfig = {
      ldapEnabled: body.ldapEnabled ?? true,
      ldapUrl: body.ldapUrl.trim(),
      ldapBindDn: body.ldapBindDn?.trim() || "",
      ldapBindPassword: "",
      ldapBaseDn: body.ldapBaseDn.trim(),
      ldapSearchFilter: body.ldapSearchFilter?.trim() || "(mail={{email}})",
      ldapNameAttribute: body.ldapNameAttribute?.trim() || "cn",
      ldapEmailAttribute: body.ldapEmailAttribute?.trim() || "mail",
      ldapRejectUnauthorized: body.ldapRejectUnauthorized ?? true,
    };

    // Encrypt password if provided
    if (body.ldapBindPassword && body.ldapBindPassword.length > 0) {
      ldapSettings.ldapBindPassword = encrypt(body.ldapBindPassword);
    }

    const now = new Date();

    await db
      .insert(systemSettings)
      .values({ key: "ldap", value: ldapSettings, updatedAt: now })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: ldapSettings, updatedAt: now },
      });

    logger.info("[setup/ldap] Configuration LDAP sauvegardée via le wizard");

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "[setup/ldap] Erreur sauvegarde config LDAP");
    return NextResponse.json(
      { error: "Erreur serveur lors de la sauvegarde de la configuration LDAP" },
      { status: 500 }
    );
  }
}

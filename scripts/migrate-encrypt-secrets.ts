/**
 * Migration ponctuelle : chiffre les identifiants LDAP et email
 * stockés en clair dans system_settings.
 *
 * Usage : npx tsx scripts/migrate-encrypt-secrets.ts
 * Idempotent : ne re-chiffre pas les valeurs déjà chiffrées.
 */

import { db } from "../src/lib/db";
import { systemSettings } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";
import { encrypt } from "../src/lib/crypto";

const ENCRYPTED_PATTERN = /^[0-9a-f]{32}:[0-9a-f]{32}:/;

interface FieldSpec {
  settingsKey: string;
  fields: string[];
}

const SPECS: FieldSpec[] = [
  { settingsKey: "ldap", fields: ["ldapBindPassword"] },
  { settingsKey: "email", fields: ["smtpPassword", "resendApiKey"] },
  { settingsKey: "smtp", fields: ["smtpPassword"] },
];

async function migrate() {
  console.log("Migration : chiffrement des secrets en base...\n");

  let changed = 0;

  for (const spec of SPECS) {
    const [row] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, spec.settingsKey))
      .limit(1);

    if (!row || !row.value || typeof row.value !== "object") continue;

    const value = { ...(row.value as Record<string, unknown>) };
    let updated = false;

    for (const field of spec.fields) {
      const v = value[field];
      if (typeof v === "string" && v.length > 0 && !ENCRYPTED_PATTERN.test(v)) {
        value[field] = encrypt(v);
        updated = true;
        console.log(`  ✓ ${spec.settingsKey}.${field} chiffré`);
      } else if (typeof v === "string" && ENCRYPTED_PATTERN.test(v)) {
        console.log(`  ⏭  ${spec.settingsKey}.${field} déjà chiffré`);
      }
    }

    if (updated) {
      await db
        .update(systemSettings)
        .set({ value, updatedAt: new Date() })
        .where(eq(systemSettings.key, spec.settingsKey));
      changed++;
    }
  }

  console.log(`\nTerminé — ${changed} entrée(s) mise(s) à jour.`);
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Erreur migration:", err);
  process.exit(1);
});

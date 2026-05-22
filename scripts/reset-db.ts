/**
 * Reset de la base de données — supprime toutes les données utilisateurs/contenu.
 * Préserve uniquement : system_settings, ai_providers, shared_presets.
 *
 * Usage : npx tsx scripts/reset-db.ts
 */

import { sql } from "drizzle-orm";
import { db } from "../src/lib/db";

if (process.env.NODE_ENV === "production") {
  console.error("❌ reset-db ne peut pas être exécuté en production.");
  process.exit(1);
}

async function resetDb() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║   Reset BDD — suppression données   ║");
  console.log("╚══════════════════════════════════════╝\n");

  // Phase 1 — tables feuilles (les plus dépendantes)
  const phase1 = [
    "webhook_deliveries",
    "event_dependencies",
    "calendar_event_attendees",
    "calendar_event_reminders",
    "calendar_subscriptions",
    "meeting_participants",
    "document_labels",
    "document_comments",
    "document_links",
    "document_embeddings",
    "document_permissions",
    "document_collab_states",
    "attachments",
    "mindmap_snapshots",
    "public_shares",
    "favorites",
    "activity_log",
    "audit_logs",
    "notifications",
    "password_reset_tokens",
    "user_status",
    "api_keys",
    "webhooks",
    "user_database_rows",
    "user_database_columns",
    "external_database_mappings",
    "external_row_tracking",
    "sync_logs",
    "spreadsheet_data",
  ];

  // Phase 2 — tables intermédiaires (templates + prompts inclus pour éviter FK vers users)
  const phase2 = [
    "ai_prompt_versions",
    "ai_prompts",
    "templates",
    "ai_usage_logs",
    "ai_quotas",
    "ai_model_assignments",
    "calendar_events",
    "calendars",
    "meetings",
    "user_databases",
    "labels",
  ];

  // Phase 3 — tables racines
  const phase3 = [
    "documents",
    "space_permissions",
    "spaces",
    "team_members",
    "teams",
    "organization_members",
    "organizations",
    "users",
  ];

  for (const phase of [phase1, phase2, phase3]) {
    for (const table of phase) {
      try {
        await db.execute(sql.raw(`DELETE FROM "${table}"`));
        console.log(`  ✓ ${table}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // Table inexistante ou déjà vide : on ignore
        if (msg.includes("does not exist")) {
          console.log(`  ⏭  ${table} (table inexistante)`);
        } else {
          console.warn(`  ⚠️  ${table} : ${msg}`);
        }
      }
    }
  }

  // Préservé : system_settings, ai_providers, shared_presets
  console.log("\n  → Préservés : system_settings, ai_providers, shared_presets");
  console.log("\n✅ Reset terminé.");
  process.exit(0);
}

resetDb().catch((err) => {
  console.error("\n❌ Erreur reset:", err);
  process.exit(1);
});
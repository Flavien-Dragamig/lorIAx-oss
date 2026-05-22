import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

/**
 * Purge toutes les données de démo.
 * Conserve : ai_providers, ai_prompts, ai_prompt_versions, system_settings.setup_completed.
 * L'ordre respecte les contraintes FK (enfants d'abord).
 */
export async function purgeAllData() {
  await db.transaction(async (tx) => {
    // 1. Logs et tracking externes
    await tx.execute(sql`DELETE FROM ai_usage_logs`);
    await tx.execute(sql`DELETE FROM ai_quotas`);
    await tx.execute(sql`DELETE FROM ai_model_assignments`);
    await tx.execute(sql`DELETE FROM sync_logs`);
    await tx.execute(sql`DELETE FROM external_row_tracking`);
    await tx.execute(sql`DELETE FROM external_database_mappings`);

    // 2. Webhook deliveries et webhooks
    await tx.execute(sql`DELETE FROM webhook_deliveries`);
    await tx.execute(sql`DELETE FROM webhooks`);

    // 3. Clés API, tokens, presets
    await tx.execute(sql`DELETE FROM api_keys`);
    await tx.execute(sql`DELETE FROM password_reset_tokens`);
    await tx.execute(sql`DELETE FROM shared_presets`);

    // 4. Réunions et visio
    await tx.execute(sql`DELETE FROM meeting_participants`);
    // Casser la référence circulaire calendar_events <-> meetings
    await tx.execute(sql`UPDATE calendar_events SET meeting_id = NULL WHERE meeting_id IS NOT NULL`);
    await tx.execute(sql`DELETE FROM meetings`);

    // 5. Calendrier (enfants d'abord)
    await tx.execute(sql`DELETE FROM event_dependencies`);
    await tx.execute(sql`DELETE FROM calendar_event_attendees`);
    await tx.execute(sql`DELETE FROM calendar_event_reminders`);
    await tx.execute(sql`DELETE FROM calendar_subscriptions`);
    await tx.execute(sql`DELETE FROM calendar_events`);
    await tx.execute(sql`DELETE FROM calendars`);
    await tx.execute(sql`DELETE FROM calendar_external_feeds`);

    // 6. Documents (enfants d'abord)
    await tx.execute(sql`DELETE FROM document_embeddings`);
    await tx.execute(sql`DELETE FROM document_collab_states`);
    await tx.execute(sql`DELETE FROM document_comments`);
    await tx.execute(sql`DELETE FROM document_links`);
    await tx.execute(sql`DELETE FROM document_permissions`);
    await tx.execute(sql`DELETE FROM public_shares`);
    await tx.execute(sql`DELETE FROM attachments`);
    await tx.execute(sql`DELETE FROM notifications`);
    await tx.execute(sql`DELETE FROM activity_log`);

    // 7. Bases de données utilisateur
    await tx.execute(sql`DELETE FROM user_database_rows`);
    await tx.execute(sql`DELETE FROM user_database_columns`);
    await tx.execute(sql`DELETE FROM user_databases`);

    // 8. Documents et templates
    await tx.execute(sql`DELETE FROM documents`);
    await tx.execute(sql`DELETE FROM templates`);

    // 9. Espaces (permissions, visio d'abord)
    await tx.execute(sql`DELETE FROM space_permissions`);
    await tx.execute(sql`DELETE FROM visio_permissions`);
    await tx.execute(sql`DELETE FROM spaces`);

    // 10. Équipes
    await tx.execute(sql`DELETE FROM team_members`);
    await tx.execute(sql`DELETE FROM teams`);

    // 11. Utilisateurs
    await tx.execute(sql`DELETE FROM users`);

    // 12. system_settings (sauf setup_completed)
    await tx.execute(
      sql`DELETE FROM system_settings WHERE key != 'setup_completed'`
    );
  });
}

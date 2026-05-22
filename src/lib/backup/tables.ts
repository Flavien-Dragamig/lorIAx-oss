/**
 * Tables containing user/business content data.
 * These are the tables that matter most for data recovery.
 */
export const CLIENT_TABLES = [
  "users",
  "teams",
  "team_members",
  "spaces",
  "documents",
"document_links",
  "space_permissions",
  "document_permissions",
  "templates",
  "attachments",
  "document_embeddings",
  "document_comments",
  "document_collab_states",
  "notifications",
  "user_databases",
  "user_database_columns",
  "user_database_rows",
  "public_shares",
  "calendars",
  "calendar_events",
  "calendar_event_attendees",
  "calendar_event_reminders",
  "event_dependencies",
  "calendar_subscriptions",
  "meetings",
  "meeting_participants",
  "favorites",
  "activity_log",
  "audit_logs",
] as const;

/**
 * Tables containing system configuration and technical data.
 */
export const TECHNICAL_TABLES = [
  "system_settings",
  "ai_providers",
  "ai_usage_logs",
  "ai_prompts",
  "ai_prompt_versions",
  "ai_quotas",
  "ai_model_assignments",
  "visio_permissions",
  "api_keys",
  "webhooks",
  "webhook_deliveries",
  "shared_presets",
  "calendar_external_feeds",
  "external_database_mappings",
  "sync_logs",
  "external_row_tracking",
  "password_reset_tokens",
] as const;

export type BackupType = "client" | "technical" | "full";

export function getTablesForType(type: BackupType): string[] {
  switch (type) {
    case "client":
      return [...CLIENT_TABLES];
    case "technical":
      return [...TECHNICAL_TABLES];
    case "full":
      return []; // empty = pg_dump all tables
  }
}

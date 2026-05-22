import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  bigint,
  timestamp,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { connectorTypeEnum } from "./schema-ai";

/** Structure stockée dans la colonne speaker_mapping (JSONB).
 * Avant attribution : objet avec _pending + segments + speakerFirstWords.
 * Après attribution : mapping speakerId → nom (Record<string, string>).
 */
export type SpeakerMappingData =
  | { _pending: true; segments: Array<{ start: number; end: number; text: string; speaker?: string }>; speakerFirstWords: Record<string, string> }
  | Record<string, string>;
export * from "./schema-ai";
import { organizations } from "./schema-org";
export * from "./schema-org";

// ============================================================
// ENUMS
// ============================================================

export const userRoleEnum = pgEnum("user_role", [
  "super_admin",
  "admin",
  "editor",
  "viewer",
]);

export const spaceTypeEnum = pgEnum("space_type", [
  "personal",
  "team",
  "organization",
]);

export const docVisibilityEnum = pgEnum("doc_visibility", [
  "private",
  "team",
  "public",
]);

export const classificationLevelEnum = pgEnum("classification_level", [
  "public",        // 1 — Communication, portfolio, offres
  "internal",      // 2 — Wiki, processus, base de connaissances
  "confidential",  // 3 — Dossiers clients, données sensibles
  "secret",        // 4 — Direction, stratégie, finances
]);

export const permissionLevelEnum = pgEnum("permission_level", [
  "viewer",
  "editor",
  "admin",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "mention",
  "comment",
  "reply",
  "share",
  "calendar_reminder",
  "calendar_invitation",
]);

export const syncProviderEnum = pgEnum("sync_provider", [
  "airtable",
  "notion",
]);

export const syncModeEnum = pgEnum("sync_mode", [
  "manual",        // Sync manuelle uniquement
  "pull",          // Auto-pull (lecture externe)
  "bidirectional", // Sync bidirectionnelle
]);

export const calendarTypeEnum = pgEnum("calendar_type", [
  "personal",
  "team",
  "organization",
]);

export const eventStatusEnum = pgEnum("event_status", [
  "confirmed",
  "tentative",
  "cancelled",
]);

export const eventVisibilityEnum = pgEnum("event_visibility", [
  "public",
  "private",
  "confidential",
]);

export const attendeeRoleEnum = pgEnum("attendee_role", [
  "organizer",
  "required",
  "optional",
]);

export const attendeeStatusEnum = pgEnum("attendee_status", [
  "accepted",
  "declined",
  "tentative",
  "needs-action",
]);

export const reminderTypeEnum = pgEnum("reminder_type", [
  "notification",
  "email",
]);

export const calendarPermissionEnum = pgEnum("calendar_permission", [
  "read",
  "write",
  "admin",
]);

export const entityTypeEnum = pgEnum("entity_type", [
  "document",
  "space",
  "template",
  "calendar_event",
  "meeting",
]);

// ============================================================
// USERS & TEAMS
// ============================================================

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 320 }).unique().notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }),
  avatarUrl: varchar("avatar_url", { length: 512 }),
  globalRole: userRoleEnum("global_role").notNull().default("editor"),
  ldapDn: varchar("ldap_dn", { length: 512 }),
  themePreferences: jsonb("theme_preferences").default("{}"),
  tokenInvalidatedAt: timestamp("token_invalidated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  },
  (t) => [
    index("idx_teams_org").on(t.organizationId),
  ]
);

export const teamMembers = pgTable(
  "team_members",
  {
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 50 }).notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.teamId, table.userId] })]
);

// ============================================================
// SPACES
// ============================================================

export const spaces = pgTable(
  "spaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).unique().notNull(),
    type: spaceTypeEnum("type").notNull().default("personal"),
    description: text("description"),
    ownerUserId: uuid("owner_user_id").references(() => users.id),
    ownerTeamId: uuid("owner_team_id").references(() => teams.id),
    gitRepoPath: varchar("git_repo_path", { length: 512 }).notNull(),
    classification: classificationLevelEnum("classification").notNull().default("internal"),
    icon: varchar("icon", { length: 50 }),
    appearancePreset: jsonb("appearance_preset"), // preset d'apparence par défaut de l'espace
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_spaces_org").on(t.organizationId),
  ]
);

// ============================================================
// DOCUMENTS
// ============================================================

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parentId: uuid("parent_id").references((): any => documents.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 500 }).notNull(),
    slug: varchar("slug", { length: 500 }).notNull(),
    filePath: varchar("file_path", { length: 1024 }).notNull(),
    visibility: docVisibilityEnum("visibility").notNull().default("team"), // deprecated — utiliser classification
    classification: classificationLevelEnum("classification").notNull().default("internal"),
    isFolder: boolean("is_folder").notNull().default(false),
    templateId: uuid("template_id").references(() => templates.id),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    lockedBy: uuid("locked_by").references(() => users.id),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    icon: varchar("icon", { length: 50 }),
    position: integer("position").notNull().default(0),
    contentText: text("content_text"),
    properties: jsonb("properties"), // propriétés de mise en page par document (ex: editorPaddingY)
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_documents_space_path").on(table.spaceId, table.filePath),
    index("idx_documents_parent").on(table.parentId),
    index("idx_documents_space").on(table.spaceId),
    index("idx_documents_updated").on(table.updatedAt),
    index("idx_documents_slug").on(table.slug),
    index("idx_documents_created_by").on(table.createdBy),
  ]
);

// ============================================================
// DOCUMENT LINKS (graph)
// ============================================================

export const documentLinks = pgTable(
  "document_links",
  {
    sourceId: uuid("source_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    targetId: uuid("target_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    linkText: varchar("link_text", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.sourceId, table.targetId] }),
    index("idx_links_source").on(table.sourceId),
    index("idx_links_target").on(table.targetId),
  ]
);

// ============================================================
// PERMISSIONS
// ============================================================

export const spacePermissions = pgTable(
  "space_permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    teamId: uuid("team_id").references(() => teams.id, {
      onDelete: "cascade",
    }),
    level: permissionLevelEnum("level").notNull().default("viewer"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_space_perm_space").on(table.spaceId),
    index("idx_space_perm_user").on(table.userId),
  ]
);

export const documentPermissions = pgTable(
  "document_permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    teamId: uuid("team_id").references(() => teams.id, {
      onDelete: "cascade",
    }),
    level: permissionLevelEnum("level").notNull().default("viewer"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_doc_perm_document").on(table.documentId)]
);

// ============================================================
// TEMPLATES
// ============================================================

export const templates = pgTable("templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  content: jsonb("content").notNull(),
  icon: varchar("icon", { length: 50 }),
  category: varchar("category", { length: 100 }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  isGlobal: boolean("is_global").notNull().default(false),
  spaceId: uuid("space_id").references(() => spaces.id, {
    onDelete: "cascade",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ============================================================
// FILE ATTACHMENTS
// ============================================================

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    filename: varchar("filename", { length: 500 }).notNull(),
    mimeType: varchar("mime_type", { length: 255 }).notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    storageKey: varchar("storage_key", { length: 1024 }).notNull(),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_attachments_document").on(table.documentId)]
);

// ============================================================
// EMBEDDINGS (pgvector)
// ============================================================

export const documentEmbeddings = pgTable(
  "document_embeddings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull().default(0),
    chunkText: text("chunk_text").notNull(),
    // Note: le champ vector sera gere via SQL brut dans la migration
    // car drizzle-orm n'a pas de support natif pour le type vector
    model: varchar("model", { length: 100 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_embeddings_doc_chunk").on(
      table.documentId,
      table.chunkIndex
    ),
  ]
);

// ============================================================
// AI PROVIDER CONFIG
// ============================================================

export const aiProviders = pgTable(
  "ai_providers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    displayName: varchar("display_name", { length: 255 }).notNull(),
    apiBaseUrl: varchar("api_base_url", { length: 512 }),
    apiKeyEnc: varchar("api_key_enc", { length: 1024 }),
    defaultModel: varchar("default_model", { length: 255 }),
    isEnabled: boolean("is_enabled").notNull().default(true),
    isDefault: boolean("is_default").notNull().default(false),
    config: jsonb("config").default("{}"),
    connectorType: connectorTypeEnum("connector_type").notNull().default("openai_compatible"),
    pricing: jsonb("pricing"),
    icon: varchar("icon", { length: 50 }),
    color: varchar("color", { length: 7 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "set null" }),
  },
  (t) => [
    index("idx_ai_providers_org").on(t.organizationId),
  ]
);

// ============================================================
// ACTIVITY LOG
// ============================================================

export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: varchar("action", { length: 100 }).notNull(),
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    metadata: jsonb("metadata").default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_activity_entity").on(table.entityType, table.entityId),
    index("idx_activity_user").on(table.userId),
  ]
);

// ============================================================
// DOCUMENT COMMENTS
// ============================================================

export const documentComments = pgTable(
  "document_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parentId: uuid("parent_id").references((): any => documentComments.id, {
      onDelete: "cascade",
    }),
    resolved: boolean("resolved").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_comments_document").on(table.documentId),
    index("idx_comments_parent").on(table.parentId),
  ]
);

// ============================================================
// NOTIFICATIONS
// ============================================================

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    message: text("message"),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "cascade",
    }),
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_notifications_user").on(table.userId),
    index("idx_notifications_user_read").on(table.userId, table.read),
  ]
);

// ============================================================
// PASSWORD RESET TOKENS
// ============================================================

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 64 }).unique().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_reset_tokens_user").on(table.userId),
    index("idx_reset_tokens_token").on(table.token),
  ]
);

// ============================================================
// DOCUMENT COLLABORATION STATES (Yjs)
// ============================================================

export const documentCollabStates = pgTable("document_collab_states", {
  documentId: uuid("document_id")
    .primaryKey()
    .references(() => documents.id, { onDelete: "cascade" }),
  yjsState: text("yjs_state").notNull(), // Base64-encoded Yjs binary state
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ============================================================
// SYSTEM SETTINGS
// ============================================================

export const systemSettings = pgTable("system_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ============================================================
// USER DATABASES (Notion/Airtable-style)
// ============================================================

export const columnTypeEnum = pgEnum("column_type", [
  "text",
  "number",
  "date",
  "formula",
  "select",
  "checkbox",
  "relation",
  "image",
  "url",
  "email",
  "attachment",
  "time",
]);

export const userDatabases = pgTable(
  "user_databases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_user_databases_space").on(table.spaceId)]
);

export const userDatabaseColumns = pgTable(
  "user_database_columns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    databaseId: uuid("database_id")
      .notNull()
      .references(() => userDatabases.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    type: columnTypeEnum("type").notNull().default("text"),
    position: integer("position").notNull().default(0),
    config: jsonb("config").default("{}"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_user_db_columns_database").on(table.databaseId)]
);

export const userDatabaseRows = pgTable(
  "user_database_rows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    databaseId: uuid("database_id")
      .notNull()
      .references(() => userDatabases.id, { onDelete: "cascade" }),
    cells: jsonb("cells").notNull().default("{}"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_user_db_rows_database").on(table.databaseId)]
);

// ============================================================
// EXTERNAL DATABASE SYNC
// ============================================================

export const externalDatabaseMappings = pgTable(
  "external_database_mappings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userDatabaseId: uuid("user_database_id")
      .notNull()
      .references(() => userDatabases.id, { onDelete: "cascade" }),
    provider: syncProviderEnum("provider").notNull(),
    externalId: varchar("external_id", { length: 512 }).notNull(),
    config: jsonb("config").default("{}"),
    credentialsEnc: varchar("credentials_enc", { length: 2048 }),
    syncMode: syncModeEnum("sync_mode").notNull().default("manual"),
    syncIntervalMin: integer("sync_interval_min"),
    columnMapping: jsonb("column_mapping").default("{}"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    lastSyncDirection: varchar("last_sync_direction", { length: 20 }),
    isSyncing: boolean("is_syncing").notNull().default(false),
    syncError: text("sync_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_ext_db_mappings_user_db").on(table.userDatabaseId),
    uniqueIndex("idx_ext_db_mappings_unique").on(table.userDatabaseId, table.provider),
  ]
);

export const syncLogs = pgTable(
  "sync_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mappingId: uuid("mapping_id")
      .notNull()
      .references(() => externalDatabaseMappings.id, { onDelete: "cascade" }),
    direction: varchar("direction", { length: 20 }).notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    rowsCreated: integer("rows_created").notNull().default(0),
    rowsUpdated: integer("rows_updated").notNull().default(0),
    rowsDeleted: integer("rows_deleted").notNull().default(0),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [index("idx_sync_logs_mapping").on(table.mappingId)]
);

export const externalRowTracking = pgTable(
  "external_row_tracking",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mappingId: uuid("mapping_id")
      .notNull()
      .references(() => externalDatabaseMappings.id, { onDelete: "cascade" }),
    loriaxRowId: uuid("loriax_row_id")
      .notNull()
      .references(() => userDatabaseRows.id, { onDelete: "cascade" }),
    externalRowId: varchar("external_row_id", { length: 512 }).notNull(),
    contentHash: varchar("content_hash", { length: 64 }),
    lastExternalChangeAt: timestamp("last_external_change_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_tracking_unique").on(table.mappingId, table.loriaxRowId),
    index("idx_tracking_external_id").on(table.mappingId, table.externalRowId),
  ]
);

// ============================================================
// API KEYS
// ============================================================

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    keyHash: varchar("key_hash", { length: 64 }).notNull(), // SHA-256
    keyPrefix: varchar("key_prefix", { length: 12 }).notNull(), // lrx_XXXXXXXX
    scopes: jsonb("scopes").notNull().default("[]"), // ["documents:read", ...]
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_api_keys_user").on(table.userId),
    index("idx_api_keys_prefix").on(table.keyPrefix),
  ]
);

// ============================================================
// WEBHOOKS
// ============================================================

export const webhooks = pgTable(
  "webhooks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    spaceId: uuid("space_id").references(() => spaces.id, {
      onDelete: "cascade",
    }),
    url: varchar("url", { length: 2048 }).notNull(),
    events: jsonb("events").notNull().default("[]"), // ["document.created", ...]
    secret: varchar("secret", { length: 64 }).notNull(),
    active: boolean("active").notNull().default(true),
    failureCount: integer("failure_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("idx_webhooks_user").on(table.userId),
    index("idx_webhooks_active").on(table.active),
    index("idx_webhooks_org").on(table.organizationId),
  ]
);

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    webhookId: uuid("webhook_id")
      .notNull()
      .references(() => webhooks.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    payload: jsonb("payload").notNull(),
    statusCode: integer("status_code"),
    responseBody: text("response_body"),
    attempts: integer("attempts").notNull().default(0),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_webhook_deliveries_webhook").on(table.webhookId),
    index("idx_webhook_deliveries_retry").on(table.nextRetryAt),
  ]
);

// ============================================================
// SHARED APPEARANCE PRESETS
// ============================================================

export const sharedPresets = pgTable(
  "shared_presets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    description: varchar("description", { length: 255 }),
    config: jsonb("config").notNull(), // { accentColor, editorFont, editorBackground, contentWidth, fontSize }
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_shared_presets_user").on(table.userId)]
);

// ============================================================
// PUBLIC SHARES (partage externe)
// ============================================================

export const publicShares = pgTable(
  "public_shares",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 64 }).unique().notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    viewCount: integer("view_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_public_shares_document").on(table.documentId),
    index("idx_public_shares_token").on(table.token),
  ]
);

// ============================================================
// CALENDARS
// ============================================================

export const calendars = pgTable(
  "calendars",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    color: varchar("color", { length: 7 }).notNull().default("#3b82f6"), // hex
    timezone: varchar("timezone", { length: 100 }).notNull().default("Europe/Paris"),
    type: calendarTypeEnum("type").notNull().default("personal"),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "cascade" }),
    ownerTeamId: uuid("owner_team_id").references(() => teams.id, { onDelete: "cascade" }),
    spaceId: uuid("space_id").references(() => spaces.id, { onDelete: "set null" }),
    caldavSlug: varchar("caldav_slug", { length: 255 }).unique().notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_calendars_owner_user").on(table.ownerUserId),
    index("idx_calendars_owner_team").on(table.ownerTeamId),
    index("idx_calendars_space").on(table.spaceId),
  ]
);

export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    calendarId: uuid("calendar_id")
      .notNull()
      .references(() => calendars.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    location: varchar("location", { length: 500 }),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    allDay: boolean("all_day").notNull().default(false),
    recurrenceRule: varchar("recurrence_rule", { length: 500 }), // iCalendar RRULE
    recurrenceExceptions: jsonb("recurrence_exceptions").default("[]"), // dates exclues
    status: eventStatusEnum("status").notNull().default("confirmed"),
    visibility: eventVisibilityEnum("visibility").notNull().default("public"),
    uid: varchar("uid", { length: 255 }).unique().notNull(), // iCalendar UID
    sequence: integer("sequence").notNull().default(0), // iCal versioning
    progress: integer("progress").notNull().default(0), // 0-100 for Gantt
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parentEventId: uuid("parent_event_id").references((): any => calendarEvents.id, {
      onDelete: "set null",
    }),
    // @deprecated — use eventDependencies table instead
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dependsOnEventId: uuid("depends_on_event_id").references((): any => calendarEvents.id, {
      onDelete: "set null",
    }),
    color: varchar("color", { length: 7 }), // hex override
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    meetingId: uuid("meeting_id").references((): any => meetings.id, {
      onDelete: "set null",
    }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_calendar_events_calendar").on(table.calendarId),
    index("idx_calendar_events_start").on(table.startAt),
    index("idx_calendar_events_end").on(table.endAt),
    index("idx_calendar_events_range").on(table.calendarId, table.startAt, table.endAt),
    index("idx_calendar_events_parent").on(table.parentEventId),
    index("idx_calendar_events_uid").on(table.uid),
    index("idx_calendar_events_meeting").on(table.meetingId),
  ]
);

export const calendarEventAttendees = pgTable(
  "calendar_event_attendees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => calendarEvents.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 320 }),
    displayName: varchar("display_name", { length: 255 }),
    role: attendeeRoleEnum("role").notNull().default("required"),
    status: attendeeStatusEnum("status").notNull().default("needs-action"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_event_attendees_event").on(table.eventId),
    index("idx_event_attendees_user").on(table.userId),
  ]
);

export const calendarEventReminders = pgTable(
  "calendar_event_reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => calendarEvents.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: reminderTypeEnum("type").notNull().default("notification"),
    minutesBefore: integer("minutes_before").notNull().default(15),
    sent: boolean("sent").notNull().default(false),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_event_reminders_event").on(table.eventId),
    index("idx_event_reminders_user").on(table.userId),
    index("idx_event_reminders_pending").on(table.sent, table.eventId),
  ]
);

export const eventDependencies = pgTable("event_dependencies", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceEventId: uuid("source_event_id").notNull()
    .references(() => calendarEvents.id, { onDelete: "cascade" }),
  targetEventId: uuid("target_event_id").notNull()
    .references(() => calendarEvents.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 20 }).notNull().default("finish-to-start"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uq_event_deps").on(table.sourceEventId, table.targetEventId),
  index("idx_event_deps_source").on(table.sourceEventId),
  index("idx_event_deps_target").on(table.targetEventId),
]);

export const calendarSubscriptions = pgTable(
  "calendar_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    calendarId: uuid("calendar_id")
      .notNull()
      .references(() => calendars.id, { onDelete: "cascade" }),
    color: varchar("color", { length: 7 }), // hex override personnel
    visible: boolean("visible").notNull().default(true),
    notifications: boolean("notifications").notNull().default(true),
    permission: calendarPermissionEnum("permission").notNull().default("read"),
    subscribedAt: timestamp("subscribed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_calendar_subs_user").on(table.userId),
    index("idx_calendar_subs_calendar").on(table.calendarId),
    uniqueIndex("idx_calendar_subs_unique").on(table.userId, table.calendarId),
  ]
);

export const calendarExternalFeeds = pgTable(
  "calendar_external_feeds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    url: text("url").notNull(),
    color: varchar("color", { length: 7 }).notNull().default("#6b7280"),
    syncIntervalMinutes: integer("sync_interval_minutes").notNull().default(60),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    lastSyncError: text("last_sync_error"),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_external_feeds_user").on(table.userId),
  ]
);

export const visioActionEnum = pgEnum("visio_action", [
  "join_immediate",
  "join_scheduled_invited",
  "join_scheduled_uninvited",
  "create_immediate",
  "create_scheduled",
  "modify_cancel",
]);

export const visioPermissions = pgTable(
  "visio_permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spaceId: uuid("space_id").references(() => spaces.id, { onDelete: "cascade" }),
    action: visioActionEnum("action").notNull(),
    role: permissionLevelEnum("role").notNull(),
    allowed: boolean("allowed").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_visio_perm").on(table.spaceId, table.action, table.role),
    index("idx_visio_perm_space").on(table.spaceId),
  ]
);

// ============================================================
// MEETINGS (Visioconférence LiveKit)
// ============================================================

export const meetingStatusEnum = pgEnum("meeting_status", [
  "scheduled",
  "active",
  "ended",
  "transcribing",
  "mapping",
  "summarizing",
  "completed",
  "failed",
]);

export const meetings = pgTable(
  "meetings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: varchar("title", { length: 255 }).notNull(),
    roomName: varchar("room_name", { length: 100 }).notNull().unique(),
    spaceId: uuid("space_id").references(() => spaces.id, {
      onDelete: "set null",
    }),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    notesDocumentId: uuid("notes_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    status: meetingStatusEnum("status").notNull().default("scheduled"),
    egressId: varchar("egress_id", { length: 255 }),
    recordingPath: varchar("recording_path", { length: 512 }),
    transcriptPath: varchar("transcript_path", { length: 512 }),
    meetingType: varchar("meeting_type", { length: 20 }).notNull().default("video"),
    participants: jsonb("participants").$type<string[]>().default([]),
    speakerMapping: jsonb("speaker_mapping").$type<SpeakerMappingData>().default({}),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    calendarEventId: uuid("calendar_event_id").references(() => calendarEvents.id, {
      onDelete: "set null",
    }),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("meetings_space_id_idx").on(table.spaceId),
    index("meetings_created_by_idx").on(table.createdBy),
    index("meetings_status_idx").on(table.status),
    index("meetings_calendar_event_id_idx").on(table.calendarEventId),
  ]
);

export const meetingParticipants = pgTable(
  "meeting_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    displayName: varchar("display_name", { length: 100 }).notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    leftAt: timestamp("left_at", { withTimezone: true }),
  },
  (table) => [
    index("meeting_participants_meeting_id_idx").on(table.meetingId),
  ]
);

// ============================================================
// BACKUP JOBS
// ============================================================

export const backupTypeEnum = pgEnum("backup_type", [
  "client",
  "technical",
  "full",
]);

export const backupStatusEnum = pgEnum("backup_status", [
  "running",
  "completed",
  "failed",
]);

export const backupJobs = pgTable("backup_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: backupTypeEnum("type").notNull(),
  status: backupStatusEnum("status").notNull().default("running"),
  triggeredBy: uuid("triggered_by").references(() => users.id, { onDelete: "set null" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  sizeBytes: bigint("size_bytes", { mode: "number" }),
  s3Key: varchar("s3_key", { length: 500 }),
  s3Bucket: varchar("s3_bucket", { length: 200 }),
  error: text("error"),
  tableCount: integer("table_count"),
}, (table) => [
  index("backup_jobs_status_idx").on(table.status),
  index("backup_jobs_type_idx").on(table.type),
  index("backup_jobs_started_at_idx").on(table.startedAt),
]);

// ============================================================
// RELATIONS
// ============================================================

export const usersRelations = relations(users, ({ many }) => ({
  teamMemberships: many(teamMembers),
  ownedSpaces: many(spaces),
  createdDocuments: many(documents),
}));

export const teamsRelations = relations(teams, ({ many }) => ({
  members: many(teamMembers),
  ownedSpaces: many(spaces),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, { fields: [teamMembers.teamId], references: [teams.id] }),
  user: one(users, { fields: [teamMembers.userId], references: [users.id] }),
}));

export const spacesRelations = relations(spaces, ({ one, many }) => ({
  ownerUser: one(users, {
    fields: [spaces.ownerUserId],
    references: [users.id],
  }),
  ownerTeam: one(teams, {
    fields: [spaces.ownerTeamId],
    references: [teams.id],
  }),
  documents: many(documents),
  permissions: many(spacePermissions),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  space: one(spaces, {
    fields: [documents.spaceId],
    references: [spaces.id],
  }),
  parent: one(documents, {
    fields: [documents.parentId],
    references: [documents.id],
    relationName: "parentChild",
  }),
  children: many(documents, { relationName: "parentChild" }),
  creator: one(users, {
    fields: [documents.createdBy],
    references: [users.id],
  }),
  template: one(templates, {
    fields: [documents.templateId],
    references: [templates.id],
  }),
  outgoingLinks: many(documentLinks, { relationName: "source" }),
  incomingLinks: many(documentLinks, { relationName: "target" }),
  embeddings: many(documentEmbeddings),
  attachments: many(attachments),
  permissions: many(documentPermissions),
  comments: many(documentComments),
  publicShares: many(publicShares),
}));

export const documentLinksRelations = relations(documentLinks, ({ one }) => ({
  source: one(documents, {
    fields: [documentLinks.sourceId],
    references: [documents.id],
    relationName: "source",
  }),
  target: one(documents, {
    fields: [documentLinks.targetId],
    references: [documents.id],
    relationName: "target",
  }),
}));

export const documentCommentsRelations = relations(documentComments, ({ one, many }) => ({
  document: one(documents, {
    fields: [documentComments.documentId],
    references: [documents.id],
  }),
  author: one(users, {
    fields: [documentComments.userId],
    references: [users.id],
  }),
  parent: one(documentComments, {
    fields: [documentComments.parentId],
    references: [documentComments.id],
    relationName: "commentReplies",
  }),
  replies: many(documentComments, { relationName: "commentReplies" }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  actor: one(users, {
    fields: [notifications.actorId],
    references: [users.id],
    relationName: "notificationActor",
  }),
  document: one(documents, {
    fields: [notifications.documentId],
    references: [documents.id],
  }),
}));

export const userDatabasesRelations = relations(userDatabases, ({ one, many }) => ({
  space: one(spaces, {
    fields: [userDatabases.spaceId],
    references: [spaces.id],
  }),
  creator: one(users, {
    fields: [userDatabases.createdBy],
    references: [users.id],
  }),
  columns: many(userDatabaseColumns),
  rows: many(userDatabaseRows),
}));

export const userDatabaseColumnsRelations = relations(userDatabaseColumns, ({ one }) => ({
  database: one(userDatabases, {
    fields: [userDatabaseColumns.databaseId],
    references: [userDatabases.id],
  }),
}));

export const userDatabaseRowsRelations = relations(userDatabaseRows, ({ one }) => ({
  database: one(userDatabases, {
    fields: [userDatabaseRows.databaseId],
    references: [userDatabases.id],
  }),
}));

export const sharedPresetsRelations = relations(sharedPresets, ({ one }) => ({
  user: one(users, {
    fields: [sharedPresets.userId],
    references: [users.id],
  }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
}));

export const publicSharesRelations = relations(publicShares, ({ one }) => ({
  document: one(documents, {
    fields: [publicShares.documentId],
    references: [documents.id],
  }),
  creator: one(users, {
    fields: [publicShares.createdBy],
    references: [users.id],
  }),
}));

export const webhooksRelations = relations(webhooks, ({ one, many }) => ({
  user: one(users, {
    fields: [webhooks.userId],
    references: [users.id],
  }),
  space: one(spaces, {
    fields: [webhooks.spaceId],
    references: [spaces.id],
  }),
  deliveries: many(webhookDeliveries),
}));

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  webhook: one(webhooks, {
    fields: [webhookDeliveries.webhookId],
    references: [webhooks.id],
  }),
}));

export const externalDatabaseMappingsRelations = relations(externalDatabaseMappings, ({ one, many }) => ({
  userDatabase: one(userDatabases, {
    fields: [externalDatabaseMappings.userDatabaseId],
    references: [userDatabases.id],
  }),
  syncLogs: many(syncLogs),
  rowTracking: many(externalRowTracking),
}));

export const syncLogsRelations = relations(syncLogs, ({ one }) => ({
  mapping: one(externalDatabaseMappings, {
    fields: [syncLogs.mappingId],
    references: [externalDatabaseMappings.id],
  }),
}));

export const externalRowTrackingRelations = relations(externalRowTracking, ({ one }) => ({
  mapping: one(externalDatabaseMappings, {
    fields: [externalRowTracking.mappingId],
    references: [externalDatabaseMappings.id],
  }),
  row: one(userDatabaseRows, {
    fields: [externalRowTracking.loriaxRowId],
    references: [userDatabaseRows.id],
  }),
}));

// ============================================================
// CALENDAR RELATIONS
// ============================================================

export const calendarsRelations = relations(calendars, ({ one, many }) => ({
  ownerUser: one(users, {
    fields: [calendars.ownerUserId],
    references: [users.id],
  }),
  ownerTeam: one(teams, {
    fields: [calendars.ownerTeamId],
    references: [teams.id],
  }),
  space: one(spaces, {
    fields: [calendars.spaceId],
    references: [spaces.id],
  }),
  events: many(calendarEvents),
  subscriptions: many(calendarSubscriptions),
}));

export const calendarEventsRelations = relations(calendarEvents, ({ one, many }) => ({
  calendar: one(calendars, {
    fields: [calendarEvents.calendarId],
    references: [calendars.id],
  }),
  creator: one(users, {
    fields: [calendarEvents.createdBy],
    references: [users.id],
  }),
  document: one(documents, {
    fields: [calendarEvents.documentId],
    references: [documents.id],
  }),
  parentEvent: one(calendarEvents, {
    fields: [calendarEvents.parentEventId],
    references: [calendarEvents.id],
    relationName: "eventChildren",
  }),
  childEvents: many(calendarEvents, { relationName: "eventChildren" }),
  dependsOn: one(calendarEvents, {
    fields: [calendarEvents.dependsOnEventId],
    references: [calendarEvents.id],
    relationName: "legacyEventDeps",
  }),
  dependedOnBy: many(calendarEvents, { relationName: "legacyEventDeps" }),
  // Nouvelles dépendances multiples via la table eventDependencies
  outgoingDependencies: many(eventDependencies, { relationName: "dependencySource" }),
  incomingDependencies: many(eventDependencies, { relationName: "dependencyTarget" }),
  attendees: many(calendarEventAttendees),
  reminders: many(calendarEventReminders),
}));

export const calendarEventAttendeesRelations = relations(calendarEventAttendees, ({ one }) => ({
  event: one(calendarEvents, {
    fields: [calendarEventAttendees.eventId],
    references: [calendarEvents.id],
  }),
  user: one(users, {
    fields: [calendarEventAttendees.userId],
    references: [users.id],
  }),
}));

export const calendarEventRemindersRelations = relations(calendarEventReminders, ({ one }) => ({
  event: one(calendarEvents, {
    fields: [calendarEventReminders.eventId],
    references: [calendarEvents.id],
  }),
  user: one(users, {
    fields: [calendarEventReminders.userId],
    references: [users.id],
  }),
}));

export const calendarSubscriptionsRelations = relations(calendarSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [calendarSubscriptions.userId],
    references: [users.id],
  }),
  calendar: one(calendars, {
    fields: [calendarSubscriptions.calendarId],
    references: [calendars.id],
  }),
}));

export const eventDependenciesRelations = relations(eventDependencies, ({ one }) => ({
  sourceEvent: one(calendarEvents, {
    fields: [eventDependencies.sourceEventId],
    references: [calendarEvents.id],
    relationName: "dependencySource",
  }),
  targetEvent: one(calendarEvents, {
    fields: [eventDependencies.targetEventId],
    references: [calendarEvents.id],
    relationName: "dependencyTarget",
  }),
}));

// ============================================================
// MEETING RELATIONS
// ============================================================

export const meetingsRelations = relations(meetings, ({ one, many }) => ({
  space: one(spaces, {
    fields: [meetings.spaceId],
    references: [spaces.id],
  }),
  document: one(documents, {
    fields: [meetings.documentId],
    references: [documents.id],
    relationName: "meetingSource",
  }),
  notesDocument: one(documents, {
    fields: [meetings.notesDocumentId],
    references: [documents.id],
    relationName: "meetingNotes",
  }),
  creator: one(users, {
    fields: [meetings.createdBy],
    references: [users.id],
  }),
  participants: many(meetingParticipants),
}));

export const meetingParticipantsRelations = relations(meetingParticipants, ({ one }) => ({
  meeting: one(meetings, {
    fields: [meetingParticipants.meetingId],
    references: [meetings.id],
  }),
  user: one(users, {
    fields: [meetingParticipants.userId],
    references: [users.id],
  }),
}));

// ============================================================
// AUDIT LOGS
// ============================================================

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 255 }).notNull(),
  details: jsonb("details"),
  ip: varchar("ip", { length: 45 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("audit_logs_user_id_idx").on(table.userId),
  index("audit_logs_action_idx").on(table.action),
  index("audit_logs_created_at_idx").on(table.createdAt),
]);

// ============================================================
// FAVORITES
// ============================================================

export const favorites = pgTable('favorites', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  entityType: entityTypeEnum('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_favorites_unique').on(table.userId, table.entityType, table.entityId),
  index('idx_favorites_user_position').on(table.userId, table.position),
]);

export const favoritesRelations = relations(favorites, ({ one }) => ({
  user: one(users, {
    fields: [favorites.userId],
    references: [users.id],
  }),
}));

// ============================================================
// SPREADSHEET DATA
// ============================================================

export const spreadsheetData = pgTable(
  "spreadsheet_data",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sheetId: text("sheet_id").unique().notNull(),
    spaceId: uuid("space_id").references(() => spaces.id, { onDelete: "cascade" }),
    data: text("data").notNull().default("[]"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_spreadsheet_data_sheet_id").on(table.sheetId),
    index("idx_spreadsheet_data_space_id").on(table.spaceId),
  ]
);

// === LABELS ===

export const labels = pgTable(
  "labels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 64 }).notNull(),
    color: varchar("color", { length: 7 }).notNull().default("#6b7280"),
    spaceId: uuid("space_id").references(() => spaces.id, { onDelete: "cascade" }),
    isGlobal: boolean("is_global").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_labels_space").on(t.spaceId),
  ]
);

export const documentLabels = pgTable(
  "document_labels",
  {
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    labelId: uuid("label_id")
      .notNull()
      .references(() => labels.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.documentId, t.labelId] }),
    index("idx_doc_labels_document").on(t.documentId),
  ]
);

export const labelsRelations = relations(labels, ({ one, many }) => ({
  space: one(spaces, {
    fields: [labels.spaceId],
    references: [spaces.id],
  }),
  creator: one(users, {
    fields: [labels.createdBy],
    references: [users.id],
  }),
  documentLabels: many(documentLabels),
}));

export const documentLabelsRelations = relations(documentLabels, ({ one }) => ({
  document: one(documents, {
    fields: [documentLabels.documentId],
    references: [documents.id],
  }),
  label: one(labels, {
    fields: [documentLabels.labelId],
    references: [labels.id],
  }),
}));

// ============================================================
// WHITEBOARD & MINDMAP
// ============================================================

export const whiteboardSnapshots = pgTable("whiteboard_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  canvasId: text("canvas_id").unique().notNull(),
  snapshot: text("snapshot").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mindmapSnapshots = pgTable("mindmap_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  mindmapId: text("mindmap_id").unique().notNull(),
  data: text("data").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userWhiteboardLibrary = pgTable("user_whiteboard_library", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  libraryItems: jsonb("library_items").notNull().default("[]"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ============================================================
// USER STATUS (PRÉSENCE)
// ============================================================

export const userStatus = pgTable(
  "user_status",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("offline"),
    customEmoji: text("custom_emoji"),
    customText: varchar("custom_text", { length: 100 }),
    customExpiresAt: timestamp("custom_expires_at", { withTimezone: true }),
    lastSeen: timestamp("last_seen", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_user_status_last_seen").on(table.lastSeen),
  ]
);

export const userStatusRelations = relations(userStatus, ({ one }) => ({
  user: one(users, { fields: [userStatus.userId], references: [users.id] }),
}));


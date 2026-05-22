import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  decimal,
} from "drizzle-orm/pg-core";
import { users } from "./schema";

// --- Enums ---

export const connectorTypeEnum = pgEnum("connector_type", [
  "anthropic",
  "openai_compatible",
  "mistral",
]);

export const aiUsageTypeEnum = pgEnum("ai_usage_type", [
  "chat",
  "summary_doc",
  "summary_meeting",
  "embeddings",
  "playground",
]);

export const aiLogStatusEnum = pgEnum("ai_log_status", [
  "success",
  "error",
  "timeout",
  "fallback",
  "quota_exceeded",
]);

export const quotaScopeEnum = pgEnum("quota_scope", [
  "org",
  "team",
  "user",
]);

export const quotaPeriodEnum = pgEnum("quota_period", [
  "daily",
  "monthly",
]);

// --- Tables ---

export const aiUsageLogs = pgTable("ai_usage_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  teamId: uuid("team_id"),
  providerId: uuid("provider_id"),
  model: varchar("model", { length: 255 }),
  usageType: aiUsageTypeEnum("usage_type").notNull(),
  tokensIn: integer("tokens_in"),
  tokensOut: integer("tokens_out"),
  latencyMs: integer("latency_ms"),
  status: aiLogStatusEnum("status").notNull(),
  errorMessage: text("error_message"),
  fallbackProviderId: uuid("fallback_provider_id"),
  promptVersionId: uuid("prompt_version_id"),
  costEstimate: decimal("cost_estimate", { precision: 10, scale: 6 }),
  requestBody: text("request_body"),
  responseBody: text("response_body"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aiPrompts = pgTable("ai_prompts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  usageType: aiUsageTypeEnum("usage_type").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aiPromptVersions = pgTable("ai_prompt_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  promptId: uuid("prompt_id")
    .notNull()
    .references(() => aiPrompts.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  userPromptTemplate: text("user_prompt_template"),
  variables: jsonb("variables").default("[]"),
  isActive: boolean("is_active").notNull().default(false),
  trafficPercentage: integer("traffic_percentage").notNull().default(100),
  changeNote: varchar("change_note", { length: 500 }).notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aiQuotas = pgTable("ai_quotas", {
  id: uuid("id").primaryKey().defaultRandom(),
  scope: quotaScopeEnum("scope").notNull(),
  scopeId: uuid("scope_id"),
  period: quotaPeriodEnum("period").notNull().default("monthly"),
  maxTokens: bigint("max_tokens", { mode: "number" }),
  maxRequests: integer("max_requests"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aiModelAssignments = pgTable("ai_model_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  usageType: aiUsageTypeEnum("usage_type").notNull().unique(),
  providerId: uuid("provider_id").notNull(),
  model: varchar("model", { length: 255 }).notNull(),
  fallbackProviderId: uuid("fallback_provider_id"),
  fallbackModel: varchar("fallback_model", { length: 255 }),
  timeoutSeconds: integer("timeout_seconds").notNull().default(30),
  maxRetries: integer("max_retries").notNull().default(1),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

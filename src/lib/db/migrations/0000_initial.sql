CREATE TYPE "public"."attendee_role" AS ENUM('organizer', 'required', 'optional');--> statement-breakpoint
CREATE TYPE "public"."attendee_status" AS ENUM('accepted', 'declined', 'tentative', 'needs-action');--> statement-breakpoint
CREATE TYPE "public"."backup_status" AS ENUM('running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."backup_type" AS ENUM('client', 'technical', 'full');--> statement-breakpoint
CREATE TYPE "public"."calendar_permission" AS ENUM('read', 'write', 'admin');--> statement-breakpoint
CREATE TYPE "public"."calendar_type" AS ENUM('personal', 'team', 'organization');--> statement-breakpoint
CREATE TYPE "public"."classification_level" AS ENUM('public', 'internal', 'confidential', 'secret');--> statement-breakpoint
CREATE TYPE "public"."column_type" AS ENUM('text', 'number', 'date', 'formula', 'select', 'checkbox', 'relation', 'image', 'url', 'email', 'attachment', 'time');--> statement-breakpoint
CREATE TYPE "public"."doc_visibility" AS ENUM('private', 'team', 'public');--> statement-breakpoint
CREATE TYPE "public"."entity_type" AS ENUM('document', 'space', 'template', 'calendar_event', 'meeting');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('confirmed', 'tentative', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."event_visibility" AS ENUM('public', 'private', 'confidential');--> statement-breakpoint
CREATE TYPE "public"."meeting_status" AS ENUM('scheduled', 'active', 'ended', 'transcribing', 'mapping', 'summarizing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('mention', 'comment', 'reply', 'share', 'calendar_reminder', 'calendar_invitation');--> statement-breakpoint
CREATE TYPE "public"."permission_level" AS ENUM('viewer', 'editor', 'admin');--> statement-breakpoint
CREATE TYPE "public"."reminder_type" AS ENUM('notification', 'email');--> statement-breakpoint
CREATE TYPE "public"."space_type" AS ENUM('personal', 'team', 'organization');--> statement-breakpoint
CREATE TYPE "public"."sync_mode" AS ENUM('manual', 'pull', 'bidirectional');--> statement-breakpoint
CREATE TYPE "public"."sync_provider" AS ENUM('airtable', 'notion');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('super_admin', 'admin', 'editor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."visio_action" AS ENUM('join_immediate', 'join_scheduled_invited', 'join_scheduled_uninvited', 'create_immediate', 'create_scheduled', 'modify_cancel');--> statement-breakpoint
CREATE TYPE "public"."ai_log_status" AS ENUM('success', 'error', 'timeout', 'fallback', 'quota_exceeded');--> statement-breakpoint
CREATE TYPE "public"."ai_usage_type" AS ENUM('chat', 'summary_doc', 'summary_meeting', 'embeddings', 'playground');--> statement-breakpoint
CREATE TYPE "public"."connector_type" AS ENUM('anthropic', 'openai_compatible', 'mistral');--> statement-breakpoint
CREATE TYPE "public"."quota_period" AS ENUM('daily', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."quota_scope" AS ENUM('org', 'team', 'user');--> statement-breakpoint
CREATE TYPE "public"."org_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid NOT NULL,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"api_base_url" varchar(512),
	"api_key_enc" varchar(1024),
	"default_model" varchar(255),
	"is_enabled" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"config" jsonb DEFAULT '{}',
	"connector_type" "connector_type" DEFAULT 'openai_compatible' NOT NULL,
	"pricing" jsonb,
	"icon" varchar(50),
	"color" varchar(7),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"key_prefix" varchar(12) NOT NULL,
	"scopes" jsonb DEFAULT '[]' NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid,
	"space_id" uuid NOT NULL,
	"filename" varchar(500) NOT NULL,
	"mime_type" varchar(255) NOT NULL,
	"size_bytes" bigint NOT NULL,
	"storage_key" varchar(1024) NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" varchar(255) NOT NULL,
	"details" jsonb,
	"ip" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backup_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "backup_type" NOT NULL,
	"status" "backup_status" DEFAULT 'running' NOT NULL,
	"triggered_by" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"size_bytes" bigint,
	"s3_key" varchar(500),
	"s3_bucket" varchar(200),
	"error" text,
	"table_count" integer
);
--> statement-breakpoint
CREATE TABLE "calendar_event_attendees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid,
	"email" varchar(320),
	"display_name" varchar(255),
	"role" "attendee_role" DEFAULT 'required' NOT NULL,
	"status" "attendee_status" DEFAULT 'needs-action' NOT NULL,
	"responded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "calendar_event_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "reminder_type" DEFAULT 'notification' NOT NULL,
	"minutes_before" integer DEFAULT 15 NOT NULL,
	"sent" boolean DEFAULT false NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"calendar_id" uuid NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"location" varchar(500),
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"recurrence_rule" varchar(500),
	"recurrence_exceptions" jsonb DEFAULT '[]',
	"status" "event_status" DEFAULT 'confirmed' NOT NULL,
	"visibility" "event_visibility" DEFAULT 'public' NOT NULL,
	"uid" varchar(255) NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"parent_event_id" uuid,
	"depends_on_event_id" uuid,
	"color" varchar(7),
	"document_id" uuid,
	"meeting_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_events_uid_unique" UNIQUE("uid")
);
--> statement-breakpoint
CREATE TABLE "calendar_external_feeds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"url" text NOT NULL,
	"color" varchar(7) DEFAULT '#6b7280' NOT NULL,
	"sync_interval_minutes" integer DEFAULT 60 NOT NULL,
	"last_sync_at" timestamp with time zone,
	"last_sync_error" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"calendar_id" uuid NOT NULL,
	"color" varchar(7),
	"visible" boolean DEFAULT true NOT NULL,
	"notifications" boolean DEFAULT true NOT NULL,
	"permission" "calendar_permission" DEFAULT 'read' NOT NULL,
	"subscribed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"color" varchar(7) DEFAULT '#3b82f6' NOT NULL,
	"timezone" varchar(100) DEFAULT 'Europe/Paris' NOT NULL,
	"type" "calendar_type" DEFAULT 'personal' NOT NULL,
	"owner_user_id" uuid,
	"owner_team_id" uuid,
	"space_id" uuid,
	"caldav_slug" varchar(255) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendars_caldav_slug_unique" UNIQUE("caldav_slug")
);
--> statement-breakpoint
CREATE TABLE "document_collab_states" (
	"document_id" uuid PRIMARY KEY NOT NULL,
	"yjs_state" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"content" text NOT NULL,
	"parent_id" uuid,
	"resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"chunk_index" integer DEFAULT 0 NOT NULL,
	"chunk_text" text NOT NULL,
	"model" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_labels" (
	"document_id" uuid NOT NULL,
	"label_id" uuid NOT NULL,
	CONSTRAINT "document_labels_document_id_label_id_pk" PRIMARY KEY("document_id","label_id")
);
--> statement-breakpoint
CREATE TABLE "document_links" (
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"link_text" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_links_source_id_target_id_pk" PRIMARY KEY("source_id","target_id")
);
--> statement-breakpoint
CREATE TABLE "document_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"user_id" uuid,
	"team_id" uuid,
	"level" "permission_level" DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"parent_id" uuid,
	"title" varchar(500) NOT NULL,
	"slug" varchar(500) NOT NULL,
	"file_path" varchar(1024) NOT NULL,
	"visibility" "doc_visibility" DEFAULT 'team' NOT NULL,
	"classification" "classification_level" DEFAULT 'internal' NOT NULL,
	"is_folder" boolean DEFAULT false NOT NULL,
	"template_id" uuid,
	"created_by" uuid NOT NULL,
	"locked_by" uuid,
	"locked_at" timestamp with time zone,
	"icon" varchar(50),
	"position" integer DEFAULT 0 NOT NULL,
	"content_text" text,
	"properties" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_dependencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_event_id" uuid NOT NULL,
	"target_event_id" uuid NOT NULL,
	"type" varchar(20) DEFAULT 'finish-to-start' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_database_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_database_id" uuid NOT NULL,
	"provider" "sync_provider" NOT NULL,
	"external_id" varchar(512) NOT NULL,
	"config" jsonb DEFAULT '{}',
	"credentials_enc" varchar(2048),
	"sync_mode" "sync_mode" DEFAULT 'manual' NOT NULL,
	"sync_interval_min" integer,
	"column_mapping" jsonb DEFAULT '{}',
	"last_sync_at" timestamp with time zone,
	"last_sync_direction" varchar(20),
	"is_syncing" boolean DEFAULT false NOT NULL,
	"sync_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_row_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mapping_id" uuid NOT NULL,
	"loriax_row_id" uuid NOT NULL,
	"external_row_id" varchar(512) NOT NULL,
	"content_hash" varchar(64),
	"last_external_change_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(64) NOT NULL,
	"color" varchar(7) DEFAULT '#6b7280' NOT NULL,
	"space_id" uuid,
	"is_global" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"user_id" uuid,
	"display_name" varchar(100) NOT NULL,
	"joined_at" timestamp with time zone,
	"left_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"room_name" varchar(100) NOT NULL,
	"space_id" uuid,
	"document_id" uuid,
	"notes_document_id" uuid,
	"status" "meeting_status" DEFAULT 'scheduled' NOT NULL,
	"egress_id" varchar(255),
	"recording_path" varchar(512),
	"transcript_path" varchar(512),
	"meeting_type" varchar(20) DEFAULT 'video' NOT NULL,
	"participants" jsonb DEFAULT '[]'::jsonb,
	"speaker_mapping" jsonb DEFAULT '{}'::jsonb,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"scheduled_at" timestamp with time zone,
	"calendar_event_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meetings_room_name_unique" UNIQUE("room_name")
);
--> statement-breakpoint
CREATE TABLE "mindmap_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mindmap_id" text NOT NULL,
	"data" text NOT NULL,
	"thumbnail_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mindmap_snapshots_mindmap_id_unique" UNIQUE("mindmap_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" varchar(500) NOT NULL,
	"message" text,
	"document_id" uuid,
	"actor_id" uuid,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "public_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"token" varchar(64) NOT NULL,
	"created_by" uuid NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_shares_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "shared_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(255),
	"config" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "space_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"user_id" uuid,
	"team_id" uuid,
	"level" "permission_level" DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"type" "space_type" DEFAULT 'personal' NOT NULL,
	"description" text,
	"owner_user_id" uuid,
	"owner_team_id" uuid,
	"git_repo_path" varchar(512) NOT NULL,
	"classification" "classification_level" DEFAULT 'internal' NOT NULL,
	"icon" varchar(50),
	"appearance_preset" jsonb,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spaces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "spreadsheet_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sheet_id" text NOT NULL,
	"space_id" uuid,
	"data" text DEFAULT '[]' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spreadsheet_data_sheet_id_unique" UNIQUE("sheet_id")
);
--> statement-breakpoint
CREATE TABLE "sync_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mapping_id" uuid NOT NULL,
	"direction" varchar(20) NOT NULL,
	"status" varchar(20) NOT NULL,
	"rows_created" integer DEFAULT 0 NOT NULL,
	"rows_updated" integer DEFAULT 0 NOT NULL,
	"rows_deleted" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" varchar(100) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(50) DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_members_team_id_user_id_pk" PRIMARY KEY("team_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"content" jsonb NOT NULL,
	"icon" varchar(50),
	"category" varchar(100),
	"created_by" uuid NOT NULL,
	"is_global" boolean DEFAULT false NOT NULL,
	"space_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_database_columns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"database_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "column_type" DEFAULT 'text' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"config" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_database_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"database_id" uuid NOT NULL,
	"cells" jsonb DEFAULT '{}' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_databases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_status" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'offline' NOT NULL,
	"custom_emoji" text,
	"custom_text" varchar(100),
	"custom_expires_at" timestamp with time zone,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_whiteboard_library" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"library_items" jsonb DEFAULT '[]' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"name" varchar(255) NOT NULL,
	"password_hash" varchar(255),
	"avatar_url" varchar(512),
	"global_role" "user_role" DEFAULT 'editor' NOT NULL,
	"ldap_dn" varchar(512),
	"theme_preferences" jsonb DEFAULT '{}',
	"token_invalidated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "visio_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid,
	"action" "visio_action" NOT NULL,
	"role" "permission_level" NOT NULL,
	"allowed" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" uuid NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"status_code" integer,
	"response_body" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"delivered_at" timestamp with time zone,
	"next_retry_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"space_id" uuid,
	"url" varchar(2048) NOT NULL,
	"events" jsonb DEFAULT '[]' NOT NULL,
	"secret" varchar(64) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"organization_id" uuid
);
--> statement-breakpoint
CREATE TABLE "whiteboard_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canvas_id" text NOT NULL,
	"snapshot" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whiteboard_snapshots_canvas_id_unique" UNIQUE("canvas_id")
);
--> statement-breakpoint
CREATE TABLE "ai_model_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usage_type" "ai_usage_type" NOT NULL,
	"provider_id" uuid NOT NULL,
	"model" varchar(255) NOT NULL,
	"fallback_provider_id" uuid,
	"fallback_model" varchar(255),
	"timeout_seconds" integer DEFAULT 30 NOT NULL,
	"max_retries" integer DEFAULT 1 NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_model_assignments_usage_type_unique" UNIQUE("usage_type")
);
--> statement-breakpoint
CREATE TABLE "ai_prompt_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prompt_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"system_prompt" text NOT NULL,
	"user_prompt_template" text,
	"variables" jsonb DEFAULT '[]',
	"is_active" boolean DEFAULT false NOT NULL,
	"traffic_percentage" integer DEFAULT 100 NOT NULL,
	"change_note" varchar(500) NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_prompts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"usage_type" "ai_usage_type" NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_prompts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "ai_quotas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" "quota_scope" NOT NULL,
	"scope_id" uuid,
	"period" "quota_period" DEFAULT 'monthly' NOT NULL,
	"max_tokens" bigint,
	"max_requests" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"team_id" uuid,
	"provider_id" uuid,
	"model" varchar(255),
	"usage_type" "ai_usage_type" NOT NULL,
	"tokens_in" integer,
	"tokens_out" integer,
	"latency_ms" integer,
	"status" "ai_log_status" NOT NULL,
	"error_message" text,
	"fallback_provider_id" uuid,
	"prompt_version_id" uuid,
	"cost_estimate" numeric(10, 6),
	"request_body" text,
	"response_body" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "org_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_members_organization_id_user_id_pk" PRIMARY KEY("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"plan" varchar(50) DEFAULT 'free' NOT NULL,
	"license_key" varchar(512),
	"max_users" integer DEFAULT 5 NOT NULL,
	"max_spaces" integer DEFAULT 2 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"stripe_customer_id" varchar(255),
	"stripe_subscription_id" varchar(255),
	"subscription_status" varchar(50) DEFAULT 'inactive',
	"trial_ends_at" timestamp with time zone,
	"max_storage_gb" numeric(6, 2) DEFAULT '1',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_providers" ADD CONSTRAINT "ai_providers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backup_jobs" ADD CONSTRAINT "backup_jobs_triggered_by_users_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event_attendees" ADD CONSTRAINT "calendar_event_attendees_event_id_calendar_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event_attendees" ADD CONSTRAINT "calendar_event_attendees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event_reminders" ADD CONSTRAINT "calendar_event_reminders_event_id_calendar_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event_reminders" ADD CONSTRAINT "calendar_event_reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_calendar_id_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_parent_event_id_calendar_events_id_fk" FOREIGN KEY ("parent_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_depends_on_event_id_calendar_events_id_fk" FOREIGN KEY ("depends_on_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_external_feeds" ADD CONSTRAINT "calendar_external_feeds_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_subscriptions" ADD CONSTRAINT "calendar_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_subscriptions" ADD CONSTRAINT "calendar_subscriptions_calendar_id_calendars_id_fk" FOREIGN KEY ("calendar_id") REFERENCES "public"."calendars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendars" ADD CONSTRAINT "calendars_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendars" ADD CONSTRAINT "calendars_owner_team_id_teams_id_fk" FOREIGN KEY ("owner_team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendars" ADD CONSTRAINT "calendars_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_collab_states" ADD CONSTRAINT "document_collab_states_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_parent_id_document_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."document_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_embeddings" ADD CONSTRAINT "document_embeddings_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_labels" ADD CONSTRAINT "document_labels_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_labels" ADD CONSTRAINT "document_labels_label_id_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."labels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_source_id_documents_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_target_id_documents_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_permissions" ADD CONSTRAINT "document_permissions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_permissions" ADD CONSTRAINT "document_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_permissions" ADD CONSTRAINT "document_permissions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_parent_id_documents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_locked_by_users_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_dependencies" ADD CONSTRAINT "event_dependencies_source_event_id_calendar_events_id_fk" FOREIGN KEY ("source_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_dependencies" ADD CONSTRAINT "event_dependencies_target_event_id_calendar_events_id_fk" FOREIGN KEY ("target_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_database_mappings" ADD CONSTRAINT "external_database_mappings_user_database_id_user_databases_id_fk" FOREIGN KEY ("user_database_id") REFERENCES "public"."user_databases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_row_tracking" ADD CONSTRAINT "external_row_tracking_mapping_id_external_database_mappings_id_fk" FOREIGN KEY ("mapping_id") REFERENCES "public"."external_database_mappings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_row_tracking" ADD CONSTRAINT "external_row_tracking_loriax_row_id_user_database_rows_id_fk" FOREIGN KEY ("loriax_row_id") REFERENCES "public"."user_database_rows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_participants" ADD CONSTRAINT "meeting_participants_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_participants" ADD CONSTRAINT "meeting_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_notes_document_id_documents_id_fk" FOREIGN KEY ("notes_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_calendar_event_id_calendar_events_id_fk" FOREIGN KEY ("calendar_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_shares" ADD CONSTRAINT "public_shares_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_shares" ADD CONSTRAINT "public_shares_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_presets" ADD CONSTRAINT "shared_presets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_permissions" ADD CONSTRAINT "space_permissions_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_permissions" ADD CONSTRAINT "space_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_permissions" ADD CONSTRAINT "space_permissions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_owner_team_id_teams_id_fk" FOREIGN KEY ("owner_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spreadsheet_data" ADD CONSTRAINT "spreadsheet_data_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_mapping_id_external_database_mappings_id_fk" FOREIGN KEY ("mapping_id") REFERENCES "public"."external_database_mappings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_database_columns" ADD CONSTRAINT "user_database_columns_database_id_user_databases_id_fk" FOREIGN KEY ("database_id") REFERENCES "public"."user_databases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_database_rows" ADD CONSTRAINT "user_database_rows_database_id_user_databases_id_fk" FOREIGN KEY ("database_id") REFERENCES "public"."user_databases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_databases" ADD CONSTRAINT "user_databases_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_databases" ADD CONSTRAINT "user_databases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_status" ADD CONSTRAINT "user_status_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_whiteboard_library" ADD CONSTRAINT "user_whiteboard_library_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visio_permissions" ADD CONSTRAINT "visio_permissions_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_prompt_versions" ADD CONSTRAINT "ai_prompt_versions_prompt_id_ai_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."ai_prompts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_prompt_versions" ADD CONSTRAINT "ai_prompt_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_prompts" ADD CONSTRAINT "ai_prompts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_activity_entity" ON "activity_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_activity_user" ON "activity_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ai_providers_org" ON "ai_providers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_api_keys_user" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_api_keys_prefix" ON "api_keys" USING btree ("key_prefix");--> statement-breakpoint
CREATE INDEX "idx_attachments_document" ON "attachments" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "backup_jobs_status_idx" ON "backup_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "backup_jobs_type_idx" ON "backup_jobs" USING btree ("type");--> statement-breakpoint
CREATE INDEX "backup_jobs_started_at_idx" ON "backup_jobs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "idx_event_attendees_event" ON "calendar_event_attendees" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_event_attendees_user" ON "calendar_event_attendees" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_event_reminders_event" ON "calendar_event_reminders" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_event_reminders_user" ON "calendar_event_reminders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_event_reminders_pending" ON "calendar_event_reminders" USING btree ("sent","event_id");--> statement-breakpoint
CREATE INDEX "idx_calendar_events_calendar" ON "calendar_events" USING btree ("calendar_id");--> statement-breakpoint
CREATE INDEX "idx_calendar_events_start" ON "calendar_events" USING btree ("start_at");--> statement-breakpoint
CREATE INDEX "idx_calendar_events_end" ON "calendar_events" USING btree ("end_at");--> statement-breakpoint
CREATE INDEX "idx_calendar_events_range" ON "calendar_events" USING btree ("calendar_id","start_at","end_at");--> statement-breakpoint
CREATE INDEX "idx_calendar_events_parent" ON "calendar_events" USING btree ("parent_event_id");--> statement-breakpoint
CREATE INDEX "idx_calendar_events_uid" ON "calendar_events" USING btree ("uid");--> statement-breakpoint
CREATE INDEX "idx_calendar_events_meeting" ON "calendar_events" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "idx_external_feeds_user" ON "calendar_external_feeds" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_calendar_subs_user" ON "calendar_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_calendar_subs_calendar" ON "calendar_subscriptions" USING btree ("calendar_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_calendar_subs_unique" ON "calendar_subscriptions" USING btree ("user_id","calendar_id");--> statement-breakpoint
CREATE INDEX "idx_calendars_owner_user" ON "calendars" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "idx_calendars_owner_team" ON "calendars" USING btree ("owner_team_id");--> statement-breakpoint
CREATE INDEX "idx_calendars_space" ON "calendars" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "idx_comments_document" ON "document_comments" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_comments_parent" ON "document_comments" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_embeddings_doc_chunk" ON "document_embeddings" USING btree ("document_id","chunk_index");--> statement-breakpoint
CREATE INDEX "idx_doc_labels_document" ON "document_labels" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_links_source" ON "document_links" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "idx_links_target" ON "document_links" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "idx_doc_perm_document" ON "document_permissions" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_documents_space_path" ON "documents" USING btree ("space_id","file_path");--> statement-breakpoint
CREATE INDEX "idx_documents_parent" ON "documents" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_documents_space" ON "documents" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "idx_documents_updated" ON "documents" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "idx_documents_slug" ON "documents" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_documents_created_by" ON "documents" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_event_deps" ON "event_dependencies" USING btree ("source_event_id","target_event_id");--> statement-breakpoint
CREATE INDEX "idx_event_deps_source" ON "event_dependencies" USING btree ("source_event_id");--> statement-breakpoint
CREATE INDEX "idx_event_deps_target" ON "event_dependencies" USING btree ("target_event_id");--> statement-breakpoint
CREATE INDEX "idx_ext_db_mappings_user_db" ON "external_database_mappings" USING btree ("user_database_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ext_db_mappings_unique" ON "external_database_mappings" USING btree ("user_database_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tracking_unique" ON "external_row_tracking" USING btree ("mapping_id","loriax_row_id");--> statement-breakpoint
CREATE INDEX "idx_tracking_external_id" ON "external_row_tracking" USING btree ("mapping_id","external_row_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_favorites_unique" ON "favorites" USING btree ("user_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_favorites_user_position" ON "favorites" USING btree ("user_id","position");--> statement-breakpoint
CREATE INDEX "idx_labels_space" ON "labels" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "meeting_participants_meeting_id_idx" ON "meeting_participants" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "meetings_space_id_idx" ON "meetings" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "meetings_created_by_idx" ON "meetings" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "meetings_status_idx" ON "meetings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "meetings_calendar_event_id_idx" ON "meetings" USING btree ("calendar_event_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_user" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_read" ON "notifications" USING btree ("user_id","read");--> statement-breakpoint
CREATE INDEX "idx_reset_tokens_user" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_reset_tokens_token" ON "password_reset_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_public_shares_document" ON "public_shares" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_public_shares_token" ON "public_shares" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_shared_presets_user" ON "shared_presets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_space_perm_space" ON "space_permissions" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "idx_space_perm_user" ON "space_permissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_spaces_org" ON "spaces" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_spreadsheet_data_sheet_id" ON "spreadsheet_data" USING btree ("sheet_id");--> statement-breakpoint
CREATE INDEX "idx_spreadsheet_data_space_id" ON "spreadsheet_data" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "idx_sync_logs_mapping" ON "sync_logs" USING btree ("mapping_id");--> statement-breakpoint
CREATE INDEX "idx_teams_org" ON "teams" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_user_db_columns_database" ON "user_database_columns" USING btree ("database_id");--> statement-breakpoint
CREATE INDEX "idx_user_db_rows_database" ON "user_database_rows" USING btree ("database_id");--> statement-breakpoint
CREATE INDEX "idx_user_databases_space" ON "user_databases" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "idx_user_status_last_seen" ON "user_status" USING btree ("last_seen");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_visio_perm" ON "visio_permissions" USING btree ("space_id","action","role");--> statement-breakpoint
CREATE INDEX "idx_visio_perm_space" ON "visio_permissions" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_webhook" ON "webhook_deliveries" USING btree ("webhook_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_retry" ON "webhook_deliveries" USING btree ("next_retry_at");--> statement-breakpoint
CREATE INDEX "idx_webhooks_user" ON "webhooks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_webhooks_active" ON "webhooks" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_webhooks_org" ON "webhooks" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_org_members_user" ON "organization_members" USING btree ("user_id");
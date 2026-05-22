-- Migration 0015 — Chat : canaux, membres, messages

DO $$ BEGIN
  CREATE TYPE "chat_channel_type" AS ENUM('direct', 'team', 'space');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "chat_channels" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "type" "chat_channel_type" NOT NULL,
  "team_id" uuid REFERENCES "teams"("id") ON DELETE CASCADE,
  "space_id" uuid REFERENCES "spaces"("id") ON DELETE CASCADE,
  "name" varchar(255),
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "chat_channel_members" (
  "channel_id" uuid NOT NULL REFERENCES "chat_channels"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "joined_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_read_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("channel_id", "user_id")
);

CREATE TABLE IF NOT EXISTS "chat_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "channel_id" uuid NOT NULL REFERENCES "chat_channels"("id") ON DELETE CASCADE,
  "author_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "content" text,
  "document_ref" uuid REFERENCES "documents"("id") ON DELETE SET NULL,
  "edited_at" timestamp with time zone,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_chat_channels_org" ON "chat_channels"("organization_id");
CREATE INDEX IF NOT EXISTS "idx_chat_channels_team" ON "chat_channels"("team_id");
CREATE INDEX IF NOT EXISTS "idx_chat_channels_space" ON "chat_channels"("space_id");
CREATE INDEX IF NOT EXISTS "idx_chat_members_user" ON "chat_channel_members"("user_id");
CREATE INDEX IF NOT EXISTS "idx_chat_messages_channel_time" ON "chat_messages"("channel_id", "created_at" DESC);

-- Ajouter 'chat_message' au type enum notification_type
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'chat_message';

-- Valeur par défaut rétention : 365 jours
INSERT INTO "system_settings" ("key", "value", "updated_at")
VALUES ('chat_retention_days', '365', now())
ON CONFLICT ("key") DO NOTHING;

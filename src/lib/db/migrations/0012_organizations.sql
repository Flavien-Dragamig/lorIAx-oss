-- Migration 0012 : tables organizations + organization_members
DO $$ BEGIN
  CREATE TYPE org_role AS ENUM ('owner', 'admin', 'member');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "organizations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" varchar(100) UNIQUE NOT NULL,
  "name" varchar(255) NOT NULL,
  "plan" varchar(50) DEFAULT 'community' NOT NULL,
  "license_key" varchar(512),
  "max_users" integer DEFAULT 5 NOT NULL,
  "max_spaces" integer DEFAULT 10 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "organization_members" (
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" org_role DEFAULT 'member' NOT NULL,
  "joined_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "organization_members_pkey" PRIMARY KEY ("organization_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "idx_org_members_user" ON "organization_members" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_organizations_slug" ON "organizations" ("slug");

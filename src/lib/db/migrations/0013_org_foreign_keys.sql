-- Migration 0013 : colonnes organization_id nullable sur spaces, teams, ai_providers, webhooks
ALTER TABLE "spaces" ADD COLUMN IF NOT EXISTS "organization_id" uuid REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "organization_id" uuid REFERENCES "organizations"("id") ON DELETE RESTRICT;
ALTER TABLE "ai_providers" ADD COLUMN IF NOT EXISTS "organization_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL;
ALTER TABLE "webhooks" ADD COLUMN IF NOT EXISTS "organization_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "idx_spaces_org" ON "spaces" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_teams_org" ON "teams" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_ai_providers_org" ON "ai_providers" ("organization_id");
CREATE INDEX IF NOT EXISTS "idx_webhooks_org" ON "webhooks" ("organization_id");

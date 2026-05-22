-- Migration 0014 : backfill org par défaut + contraintes NOT NULL

-- Créer l'organisation par défaut
INSERT INTO "organizations" ("slug", "name", "plan", "max_users", "max_spaces")
VALUES ('default', 'LorIAx', 'community', 999, 9999)
ON CONFLICT ("slug") DO NOTHING;

-- Lier toutes les entités existantes à l'org par défaut
UPDATE "spaces"
SET "organization_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'default')
WHERE "organization_id" IS NULL;

UPDATE "teams"
SET "organization_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'default')
WHERE "organization_id" IS NULL;

UPDATE "ai_providers"
SET "organization_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'default')
WHERE "organization_id" IS NULL;

UPDATE "webhooks"
SET "organization_id" = (SELECT "id" FROM "organizations" WHERE "slug" = 'default')
WHERE "organization_id" IS NULL;

-- Inscrire tous les utilisateurs existants comme membres de l'org par défaut
INSERT INTO "organization_members" ("organization_id", "user_id", "role")
SELECT
  (SELECT "id" FROM "organizations" WHERE "slug" = 'default'),
  "id",
  CASE WHEN "global_role" = 'super_admin' THEN 'owner' ELSE 'member' END
FROM "users"
ON CONFLICT DO NOTHING;

-- Rendre NOT NULL sur spaces et teams (pas sur ai_providers/webhooks — nullable = config globale)
ALTER TABLE "spaces" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "teams" ALTER COLUMN "organization_id" SET NOT NULL;

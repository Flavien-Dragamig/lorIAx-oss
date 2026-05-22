-- Remap des plans historiques (free/starter/pro/team) vers la nouvelle grille
-- free/growth/enterprise (spec : docs/superpowers/specs/2026-05-11-monetisation-360-design.md).
--
-- Joué manuellement après déploiement (hors-journal Drizzle, comme 0019_saas_billing.sql).
-- Idempotent : sûr à rejouer.

-- 1) Bascule les anciens plans payants sur "growth"
UPDATE "organizations"
   SET "plan" = 'growth',
       "max_users" = 9999,
       "max_spaces" = 9999,
       "max_storage_gb" = 50,
       "updated_at" = NOW()
 WHERE "plan" IN ('starter', 'pro', 'team');

-- 2) Normalise community → free (self-hosted gratuit unifié)
UPDATE "organizations"
   SET "plan" = 'free',
       "updated_at" = NOW()
 WHERE "plan" = 'community';

-- 3) Aligne les limites Free sur la nouvelle grille (5 users / 2 spaces / 1 Go)
UPDATE "organizations"
   SET "max_users" = 5,
       "max_spaces" = 2,
       "max_storage_gb" = 1,
       "updated_at" = NOW()
 WHERE "plan" = 'free';

-- 4) Met à jour les DEFAULTs de la table pour les futures insertions
ALTER TABLE "organizations" ALTER COLUMN "plan" SET DEFAULT 'free';
ALTER TABLE "organizations" ALTER COLUMN "max_spaces" SET DEFAULT 2;
ALTER TABLE "organizations" ALTER COLUMN "max_storage_gb" SET DEFAULT 1;

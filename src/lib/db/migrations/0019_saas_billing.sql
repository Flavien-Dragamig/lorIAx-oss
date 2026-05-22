ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "stripe_customer_id" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "stripe_subscription_id" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "subscription_status" VARCHAR(50) DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS "trial_ends_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "max_storage_gb" NUMERIC(6,2) DEFAULT 0.5;

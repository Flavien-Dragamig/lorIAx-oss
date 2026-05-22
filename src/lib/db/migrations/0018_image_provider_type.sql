-- Migration 0018: ajouter providerType + baseUrl à image_providers
ALTER TABLE image_providers ADD COLUMN IF NOT EXISTS provider_type VARCHAR(50) NOT NULL DEFAULT 'custom';
ALTER TABLE image_providers ADD COLUMN IF NOT EXISTS base_url VARCHAR(500);

-- Backfill des providers existants dont le name correspond à un type connu
UPDATE image_providers
SET provider_type = name
WHERE name IN ('unsplash', 'pexels', 'pixabay', 'shutterstock', 'getty');

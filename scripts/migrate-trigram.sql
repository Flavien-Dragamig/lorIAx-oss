-- Migration : Index trigram pour la recherche courte (< 4 caractères)
-- Améliore les performances des requêtes ILIKE sur title et content_text
-- Usage : psql $DATABASE_URL -f scripts/migrate-trigram.sql

-- Activer l'extension pg_trgm si pas déjà fait
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Index GIN trigram sur le titre des documents
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_title_trgm
  ON documents USING gin (title gin_trgm_ops);

-- Index GIN trigram sur le contenu texte des documents
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_content_text_trgm
  ON documents USING gin (content_text gin_trgm_ops);

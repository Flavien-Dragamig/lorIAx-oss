-- Migration : Recherche full-text PostgreSQL (tsvector + pg_trgm)
-- Exécuter avec : psql $DATABASE_URL -f scripts/migrate-fts.sql

-- Activer pg_trgm pour la recherche floue (trigrams)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Ajouter une colonne tsvector sur la table documents
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Remplir la colonne pour les documents existants (config française)
UPDATE documents
SET search_vector =
  setweight(to_tsvector('french', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('french', COALESCE(content_text, '')), 'B');

-- Index GIN pour la recherche full-text
CREATE INDEX IF NOT EXISTS idx_documents_search_vector
  ON documents USING GIN (search_vector);

-- Index GIN trigram sur le titre (pour la recherche floue / autocomplétion)
CREATE INDEX IF NOT EXISTS idx_documents_title_trgm
  ON documents USING GIN (title gin_trgm_ops);

-- Index GIN trigram sur le contenu (pour la recherche floue)
CREATE INDEX IF NOT EXISTS idx_documents_content_trgm
  ON documents USING GIN (content_text gin_trgm_ops);

-- Fonction trigger pour maintenir search_vector à jour
CREATE OR REPLACE FUNCTION documents_search_vector_trigger()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('french', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('french', COALESCE(NEW.content_text, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger sur INSERT et UPDATE
DROP TRIGGER IF EXISTS trg_documents_search_vector ON documents;
CREATE TRIGGER trg_documents_search_vector
  BEFORE INSERT OR UPDATE OF title, content_text ON documents
  FOR EACH ROW
  EXECUTE FUNCTION documents_search_vector_trigger();

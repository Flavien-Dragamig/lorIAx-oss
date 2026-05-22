-- Extensions necessaires pour LorIAx
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
-- btree_gist : utilisé par la contrainte d'exclusion sur les réservations de salles
CREATE EXTENSION IF NOT EXISTS "btree_gist";

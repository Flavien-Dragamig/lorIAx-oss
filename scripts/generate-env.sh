#!/bin/bash
# ============================================================
# LorIAx — Generateur de variables d'environnement (production)
# Usage : bash scripts/generate-env.sh
#         bash scripts/generate-env.sh > .env
# ============================================================

set -euo pipefail

NEXTAUTH_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)
POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')
S3_ACCESS_KEY=$(openssl rand -hex 12)
S3_SECRET_KEY=$(openssl rand -base64 24 | tr -d '/+=')

cat <<EOF
# ===========================================
# LorIAx — Variables d'environnement (prod)
# Genere le $(date +%Y-%m-%d)
# ===========================================

# --- Base de donnees ---
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

# --- Authentification ---
NEXTAUTH_URL=https://loriax.dragamig.fr
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}

# --- Chiffrement ---
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# --- Stockage S3 (Garage) ---
S3_ACCESS_KEY=${S3_ACCESS_KEY}
S3_SECRET_KEY=${S3_SECRET_KEY}
S3_BUCKET=loriax-files
S3_REGION=garage
S3_USE_SSL=false

# --- CSP / WebSocket ---
S3_PUBLIC_URL=https://s3-loriax.dragamig.fr
WS_URL=wss://loriax.dragamig.fr

# --- IA (decommenter et renseigner) ---
# ANTHROPIC_API_KEY=
# OPENAI_API_KEY=
# DEFAULT_AI_PROVIDER=claude
# DEFAULT_AI_MODEL=claude-sonnet-4-20250514

# --- Embeddings (decommenter si provider IA configure) ---
# EMBEDDING_PROVIDER=openai
# EMBEDDING_MODEL=text-embedding-3-small
# EMBEDDING_DIMENSIONS=1536

# --- CalDAV ---
# CALDAV_ENABLED=false
# CALDAV_BASE_URL=https://loriax.dragamig.fr
EOF

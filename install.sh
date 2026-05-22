#!/bin/bash
# ============================================================
# LorIAx — Script d'installation auto-hébergée
# Usage : bash install.sh
# ============================================================

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${BLUE}[LorIAx]${NC} $1"; }
success() { echo -e "${GREEN}[LorIAx]${NC} $1"; }
warn()    { echo -e "${YELLOW}[LorIAx]${NC} $1"; }
error()   { echo -e "${RED}[LorIAx]${NC} $1"; exit 1; }

echo ""
echo "  ██╗      ██████╗ ██████╗ ██╗ █████╗ ██╗  ██╗"
echo "  ██║     ██╔═══██╗██╔══██╗██║██╔══██╗╚██╗██╔╝"
echo "  ██║     ██║   ██║██████╔╝██║███████║ ╚███╔╝ "
echo "  ██║     ██║   ██║██╔══██╗██║██╔══██║ ██╔██╗ "
echo "  ███████╗╚██████╔╝██║  ██║██║██║  ██║██╔╝ ██╗"
echo "  ╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚═╝╚═╝  ╚═╝╚═╝  ╚═╝"
echo ""
info "Installation de LorIAx — Plateforme collaborative de gestion de connaissances"
echo ""

# --- Vérifications préalables ---

command -v docker >/dev/null 2>&1 || error "Docker n'est pas installé. Voir : https://docs.docker.com/engine/install/"
docker compose version >/dev/null 2>&1 || error "Docker Compose v2 requis. Voir : https://docs.docker.com/compose/install/"

info "Docker détecté : $(docker --version)"

# --- Clé de licence ---

echo ""
warn "Une clé de licence est requise pour utiliser LorIAx en auto-hébergement."
warn "Obtenez la vôtre sur : https://loriax.fr/licences"
echo ""
read -rp "  Clé de licence (XXXX-XXXX-XXXX-XXXX) : " LICENSE_KEY
[ -z "$LICENSE_KEY" ] && error "Clé de licence requise."

# --- Domaine ---

echo ""
read -rp "  Domaine de votre instance (ex: loriax.monentreprise.fr) : " APP_DOMAIN
[ -z "$APP_DOMAIN" ] && error "Domaine requis."
APP_URL="https://${APP_DOMAIN}"

# --- Génération des secrets ---

info "Génération des secrets..."
POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)
NEXTAUTH_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)
S3_ACCESS_KEY="loriax_$(openssl rand -hex 8)"
S3_SECRET_KEY=$(openssl rand -hex 32)

# --- Création du .env ---

if [ -f .env ]; then
    warn ".env existant détecté — sauvegarde vers .env.backup"
    cp .env .env.backup
fi

info "Création du fichier .env..."
cat > .env <<EOF
# Généré par install.sh le $(date '+%Y-%m-%d %H:%M:%S')

# Base de données
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
DATABASE_URL=postgresql://loriax:${POSTGRES_PASSWORD}@pgbouncer:6432/loriax

# Authentification
NEXTAUTH_URL=${APP_URL}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}

# Chiffrement
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# Stockage objet (Garage S3)
S3_ENDPOINT=garage
S3_PORT=3900
S3_ACCESS_KEY=${S3_ACCESS_KEY}
S3_SECRET_KEY=${S3_SECRET_KEY}
S3_BUCKET=loriax-files
S3_REGION=garage
S3_USE_SSL=false

# Licence
LICENSE_MANAGER_URL=https://licences.loriax.fr
LORIAX_LICENSE_KEY=${LICENSE_KEY}

# Chemins
WORKSPACES_PATH=/app/workspaces

# IA (optionnel — configurable via l'interface admin)
# ANTHROPIC_API_KEY=
# OPENAI_API_KEY=
# MISTRAL_API_KEY=
DEFAULT_AI_PROVIDER=ollama
DEFAULT_AI_MODEL=gemma4:e4b

# Visioconférence (optionnel)
LIVEKIT_ENABLED=false
WHISPER_ENABLED=false
EOF

success ".env créé."

# --- Lancement des services ---

echo ""
info "Téléchargement et démarrage des services (peut prendre quelques minutes)..."
docker compose -f docker-compose.client.yml pull
docker compose -f docker-compose.client.yml up -d

# --- Migrations base de données ---

info "Application des migrations de base de données..."
sleep 5
docker compose -f docker-compose.client.yml exec app node -e "
  const { migrate } = require('drizzle-orm/node-postgres/migrator');
  const { db } = require('./src/lib/db');
  migrate(db, { migrationsFolder: './migrations' }).then(() => process.exit(0));
" 2>/dev/null || docker compose -f docker-compose.client.yml exec app npm run db:migrate 2>/dev/null || warn "Migration à lancer manuellement : docker compose -f docker-compose.client.yml exec app npm run db:migrate"

# --- Résumé ---

echo ""
echo "  ┌─────────────────────────────────────────────────────┐"
echo "  │                                                     │"
success "  │   LorIAx est installé et démarré !                 │"
echo "  │                                                     │"
echo "  │   URL         : ${APP_URL}"
echo "  │   Compte admin: admin@${APP_DOMAIN}"
echo "  │                                                     │"
echo "  │   Prochaine étape : configurez votre reverse proxy  │"
echo "  │   (Nginx, Caddy, Traefik) pour pointer vers         │"
echo "  │   http://localhost:3000                             │"
echo "  │                                                     │"
echo "  │   Logs : docker compose -f docker-compose.client.yml logs -f  │"
echo "  └─────────────────────────────────────────────────────┘"
echo ""
warn "Conservez le fichier .env en lieu sûr — il contient vos secrets."
echo ""

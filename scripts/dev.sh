#!/usr/bin/env bash
# ============================================================
# LorIAx — Script de lancement complet en dev
# Usage : ./scripts/dev.sh
# ============================================================

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo -e "${CYAN}"
echo "  ╔═══════════════════════════════════════════╗"
echo "  ║          LorIAx — Dev Environment         ║"
echo "  ╚═══════════════════════════════════════════╝"
echo -e "${NC}"

# ----------------------------------------------------------
# 1. Verifier les pre-requis
# ----------------------------------------------------------
echo -e "${BLUE}[1/7]${NC} Verification des pre-requis..."

missing=()
command -v docker >/dev/null 2>&1 || missing+=("docker")
command -v node >/dev/null 2>&1 || missing+=("node")
command -v npm >/dev/null 2>&1 || missing+=("npm")

if [ ${#missing[@]} -ne 0 ]; then
  echo -e "${RED}Erreur : outils manquants : ${missing[*]}${NC}"
  exit 1
fi

# Verifier que Docker daemon tourne
if ! docker info >/dev/null 2>&1; then
  echo -e "${RED}Erreur : le daemon Docker n'est pas demarre${NC}"
  echo "  → Lancez Docker Desktop ou 'sudo systemctl start docker'"
  exit 1
fi

echo -e "  ${GREEN}✓${NC} docker $(docker --version | grep -oP '\d+\.\d+\.\d+')"
echo -e "  ${GREEN}✓${NC} node $(node --version)"
echo -e "  ${GREEN}✓${NC} npm $(npm --version)"

# ----------------------------------------------------------
# 2. Fichier .env.local
# ----------------------------------------------------------
echo -e "${BLUE}[2/7]${NC} Configuration environnement..."

if [ ! -f .env.local ]; then
  echo -e "  ${YELLOW}⚠${NC}  .env.local absent — creation depuis .env.example"
  cp .env.example .env.local
  # Generer un secret NextAuth aleatoire
  SECRET=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)
  ENC_KEY=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)
  S3_KEY_ID="GK$(node -e "process.stdout.write(require('crypto').randomBytes(12).toString('hex'))" 2>/dev/null || openssl rand -hex 12)"
  S3_KEY_SECRET=$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null || openssl rand -hex 32)
  sed -i "s|generate-a-random-secret-here|${SECRET}|" .env.local
  sed -i "s|generate-a-32-byte-base64-key-here|${ENC_KEY}|" .env.local
  sed -i "s|GK6c6f72696178000000000000|${S3_KEY_ID}|" .env.local
  sed -i "s|6c6f726961787365637265740000000000000000000000000000000000000000|${S3_KEY_SECRET}|" .env.local
  echo -e "  ${GREEN}✓${NC} .env.local cree (NEXTAUTH_SECRET, ENCRYPTION_KEY, S3 credentials generes)"
  echo -e "  ${YELLOW}→${NC} Pensez a renseigner vos cles API (Anthropic, OpenAI) dans .env.local"
else
  echo -e "  ${GREEN}✓${NC} .env.local existe"
fi

# Générer ENCRYPTION_KEY si manquant ou par défaut
if grep -qE '^ENCRYPTION_KEY=generate-' .env.local 2>/dev/null; then
  ENC_KEY=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)
  sed -i "s|generate-a-32-byte-base64-key-here|${ENC_KEY}|" .env.local
  echo -e "  ${GREEN}✓${NC} ENCRYPTION_KEY genere"
fi

# ----------------------------------------------------------
# 3. Dossier workspaces (stockage markdown)
# ----------------------------------------------------------
echo -e "${BLUE}[3/7]${NC} Dossier workspaces..."

mkdir -p workspaces
echo -e "  ${GREEN}✓${NC} ./workspaces/ pret"

# ----------------------------------------------------------
# 4. Dependances npm
# ----------------------------------------------------------
echo -e "${BLUE}[4/7]${NC} Dependances npm..."

if [ ! -d node_modules ] || [ package.json -nt node_modules ]; then
  echo "  Installation des dependances..."
  npm install --loglevel=warn
else
  echo -e "  ${GREEN}✓${NC} node_modules a jour"
fi

# ----------------------------------------------------------
# 5. Services Docker (PostgreSQL + Garage S3 + LiveKit optionnel)
# ----------------------------------------------------------

# Détecter si LiveKit est activé dans .env.local
LIVEKIT_ENABLED=$(grep -E '^LIVEKIT_ENABLED=true' .env.local 2>/dev/null | head -1)
LIVEKIT_COMPOSE=""
if [ -n "$LIVEKIT_ENABLED" ]; then
  LIVEKIT_COMPOSE="-f docker-compose.livekit.yml"
fi

# Détecter si Penpot est activé dans .env.local
PENPOT_ENABLED=$(grep -E '^PENPOT_ENABLED=true' .env.local 2>/dev/null | head -1)
PENPOT_COMPOSE=""
if [ -n "$PENPOT_ENABLED" ]; then
  PENPOT_COMPOSE="-f docker-compose.penpot.yml"
fi

# Afficher les services qui seront lancés
SERVICES_LABEL="PostgreSQL + Garage S3 + Ollama"
[ -n "$LIVEKIT_ENABLED" ] && SERVICES_LABEL="$SERVICES_LABEL + LiveKit + Whisper"
[ -n "$PENPOT_ENABLED" ] && SERVICES_LABEL="$SERVICES_LABEL + Penpot"
echo -e "${BLUE}[5/7]${NC} Services Docker ($SERVICES_LABEL)..."

# On utilise le docker-compose principal mais sans le service app
# Ollama démarre systématiquement (compose principal)
# LiveKit + Egress + Whisper démarrent ensemble si LIVEKIT_ENABLED=true
docker compose -f docker-compose.yml $LIVEKIT_COMPOSE $PENPOT_COMPOSE up -d postgres garage garage-init ollama ${LIVEKIT_ENABLED:+livekit livekit-egress whisper} ${PENPOT_ENABLED:+penpot-frontend penpot-backend penpot-exporter penpot-valkey} 2>&1 | while read -r line; do
  echo "  $line"
done

# Attendre que PostgreSQL soit pret
echo -n "  Attente de PostgreSQL"
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U loriax -d loriax >/dev/null 2>&1; then
    echo -e "\n  ${GREEN}✓${NC} PostgreSQL pret (port 5432)"
    break
  fi
  echo -n "."
  sleep 1
  if [ "$i" -eq 30 ]; then
    echo -e "\n  ${RED}✗ PostgreSQL n'a pas demarre dans les 30s${NC}"
    exit 1
  fi
done

# Verifier les extensions pgvector
docker compose exec -T postgres psql -U loriax -d loriax -c "CREATE EXTENSION IF NOT EXISTS vector; CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE EXTENSION IF NOT EXISTS pgcrypto;" >/dev/null 2>&1
echo -e "  ${GREEN}✓${NC} Extensions PostgreSQL (pgvector, pg_trgm, pgcrypto) activees"

# Attendre Garage S3
echo -n "  Attente de Garage S3"
for i in $(seq 1 20); do
  if curl -sf http://localhost:3903/health >/dev/null 2>&1; then
    echo -e "\n  ${GREEN}✓${NC} Garage S3 pret (API: 3900, admin: 3903)"
    break
  fi
  echo -n "."
  sleep 1
  if [ "$i" -eq 20 ]; then
    echo -e "\n  ${YELLOW}⚠${NC}  Garage pas encore pret — il demarrera en arriere-plan"
  fi
done

# Attendre que garage-init termine (crée le bucket + les clés S3)
echo -n "  Attente de garage-init (bucket + clés S3)"
if docker compose wait garage-init 2>/dev/null; then
  echo -e "\n  ${GREEN}✓${NC} Bucket S3 initialisé"
else
  echo -e "\n  ${YELLOW}⚠${NC}  garage-init — verifiez avec : docker compose logs garage-init"
fi

# Attendre Ollama et pull du modèle par défaut
echo -n "  Attente de Ollama"
for i in $(seq 1 30); do
  if curl -sf http://localhost:11434/api/tags >/dev/null 2>&1; then
    echo -e "\n  ${GREEN}✓${NC} Ollama pret (port 11434)"
    break
  fi
  echo -n "."
  sleep 1
  if [ "$i" -eq 30 ]; then
    echo -e "\n  ${YELLOW}⚠${NC}  Ollama pas encore pret — il demarrera en arriere-plan"
  fi
done

# Pull du modèle par défaut si absent
if curl -sf http://localhost:11434/api/tags 2>/dev/null | grep -q "gemma4:e4b"; then
  echo -e "  ${GREEN}✓${NC} Modele gemma4:e4b deja present"
else
  echo -e "  ${YELLOW}→${NC} Pull du modele gemma4:e4b (premiere fois, ~4 Go, multimodal vision)..."
  docker compose exec -T ollama ollama pull gemma4:e4b 2>&1 | tail -3 | while read -r line; do
    echo "    $line"
  done
  echo -e "  ${GREEN}✓${NC} Modele gemma4:e4b installe"
fi

# Attendre LiveKit (si activé)
if [ -n "$LIVEKIT_ENABLED" ]; then
  echo -n "  Attente de LiveKit"
  for i in $(seq 1 15); do
    if curl -sf http://localhost:7880 >/dev/null 2>&1; then
      echo -e "\n  ${GREEN}✓${NC} LiveKit pret (ws://localhost:7880)"
      break
    fi
    echo -n "."
    sleep 1
    if [ "$i" -eq 15 ]; then
      echo -e "\n  ${YELLOW}⚠${NC}  LiveKit pas encore pret — il demarrera en arriere-plan"
    fi
  done

  # Attendre Whisper
  echo -n "  Attente de Whisper"
  for i in $(seq 1 30); do
    if curl -sf http://localhost:9000/docs >/dev/null 2>&1; then
      echo -e "\n  ${GREEN}✓${NC} Whisper pret (port 9000)"
      break
    fi
    echo -n "."
    sleep 1
    if [ "$i" -eq 30 ]; then
      echo -e "\n  ${YELLOW}⚠${NC}  Whisper pas encore pret — il demarrera en arriere-plan"
    fi
  done

fi

# Attendre Penpot (si activé)
if [ -n "$PENPOT_ENABLED" ]; then
  echo -n "  Attente de Penpot"
  for i in $(seq 1 30); do
    if curl -sf http://localhost:9002 >/dev/null 2>&1; then
      echo -e "\n  ${GREEN}✓${NC} Penpot pret (frontend: 9002, backend: 6060)"
      break
    fi
    echo -n "."
    sleep 1
    if [ "$i" -eq 30 ]; then
      echo -e "\n  ${YELLOW}⚠${NC}  Penpot pas encore pret — il demarrera en arriere-plan"
    fi
  done
fi

# Initialiser le compte service Penpot (si activé)
if [ -n "$PENPOT_ENABLED" ]; then
  PENPOT_SECRET_KEY=$(grep -E '^PENPOT_SECRET_KEY=' .env.local 2>/dev/null | head -1 | cut -d= -f2-)
  if [ -n "$PENPOT_SECRET_KEY" ]; then
    echo -e "  Initialisation du compte service Penpot..."
    # Tenter le login — si 400 wrong-credentials, créer le compte
    LOGIN_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost:6060/api/rpc/command/login-with-password \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"loriax-system@loriax.dev\",\"password\":\"${PENPOT_SECRET_KEY}\"}" 2>/dev/null)
    if [ "$LOGIN_STATUS" = "200" ]; then
      echo -e "  ${GREEN}✓${NC} Compte service Penpot deja cree"
    else
      # Créer le profil service
      CREATE_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost:6060/api/rpc/command/prepare-register-profile \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"loriax-system@loriax.dev\",\"password\":\"${PENPOT_SECRET_KEY}\",\"fullname\":\"LorIAx System\"}" 2>/dev/null)
      if [ "$CREATE_STATUS" = "200" ]; then
        # Finaliser l'enregistrement (Penpot 2.x requiert un token de confirmation)
        REGISTER_TOKEN=$(curl -sf http://localhost:6060/api/rpc/command/prepare-register-profile \
          -H "Content-Type: application/json" \
          -d "{\"email\":\"loriax-system@loriax.dev\",\"password\":\"${PENPOT_SECRET_KEY}\",\"fullname\":\"LorIAx System\"}" 2>/dev/null | python3 -c "import sys,json;print(json.loads(sys.stdin.read().replace('\"~:','\"').replace('\"^ \",',''))['token'])" 2>/dev/null)
        if [ -n "$REGISTER_TOKEN" ]; then
          curl -sf http://localhost:6060/api/rpc/command/register-profile \
            -H "Content-Type: application/json" \
            -d "{\"token\":\"${REGISTER_TOKEN}\"}" >/dev/null 2>&1
        fi
        echo -e "  ${GREEN}✓${NC} Compte service Penpot cree"
      else
        echo -e "  ${YELLOW}⚠${NC}  Impossible de creer le compte service Penpot (status: $CREATE_STATUS)"
      fi
    fi
  fi
fi

# ----------------------------------------------------------
# 6. Schema BDD (Drizzle push)
# ----------------------------------------------------------
echo -e "${BLUE}[6/7]${NC} Schema BDD (Drizzle push)..."

# drizzle-kit push nécessite un TTY interactif — utilise --force pour éviter les prompts
DATABASE_URL=$(grep DATABASE_URL .env.local 2>/dev/null | head -1 | cut -d= -f2-)
if [ -n "$DATABASE_URL" ]; then
  DATABASE_URL="$DATABASE_URL" npx drizzle-kit push --force 2>&1 | tail -5 | while read -r line; do
    echo "  $line"
  done
else
  npx drizzle-kit push --force 2>&1 | tail -5 | while read -r line; do
    echo "  $line"
  done
fi
echo -e "  ${GREEN}✓${NC} Schema applique"

# Enregistrer les migrations dans le registre Drizzle
# (évite que server.ts tente de les rejouer au démarrage)
npx tsx --env-file=.env.local scripts/mark-migrations-applied.ts 2>&1 | while read -r line; do
  echo "  $line"
done

# Seed des utilisateurs de dev
echo "  Seed des utilisateurs de dev..."
npx tsx scripts/seed-dev-users.ts 2>&1 | while read -r line; do
  echo "  $line"
done

# ----------------------------------------------------------
# 7. Lancement Next.js dev
# ----------------------------------------------------------
APP_URL="http://localhost:3000"
BOLD='\033[1m'

echo ""
echo -e "${CYAN}  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "     ${GREEN}${BOLD}✓  LorIAx est prêt !${NC}"
echo -e "${CYAN}  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${GREEN}➜${NC}  ${BOLD}Application${NC}     ${CYAN}${APP_URL}${NC}"
echo -e "  ${BLUE}○${NC}  Garage S3       http://localhost:3900"
echo -e "  ${BLUE}○${NC}  PostgreSQL      localhost:5432"
echo -e "  ${BLUE}○${NC}  Ollama          http://localhost:11434"
echo -e "  ${BLUE}○${NC}  Drizzle Studio  npx drizzle-kit studio"
if [ -n "$LIVEKIT_ENABLED" ]; then
  echo -e "  ${BLUE}○${NC}  LiveKit         ws://localhost:7880"
  echo -e "  ${BLUE}○${NC}  Whisper         http://localhost:9000"
fi
if [ -n "$PENPOT_ENABLED" ]; then
  echo -e "  ${BLUE}○${NC}  Penpot          http://localhost:9002"
fi
echo ""
echo -e "  ${YELLOW}Ctrl+C${NC} pour arrêter Next.js  ·  ${YELLOW}docker compose down${NC} pour Docker"
echo ""

# Ouvrir le navigateur quand Next.js sera prêt
(
  for i in $(seq 1 30); do
    if curl -sf "${APP_URL}" >/dev/null 2>&1; then
      if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "${APP_URL}" 2>/dev/null
      elif command -v open >/dev/null 2>&1; then
        open "${APP_URL}" 2>/dev/null
      fi
      break
    fi
    sleep 1
  done
) &

echo -e "${BLUE}[7/7]${NC} Démarrage de Next.js..."
exec npm run dev

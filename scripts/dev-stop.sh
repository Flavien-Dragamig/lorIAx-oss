#!/usr/bin/env bash
# ============================================================
# LorIAx — Arret propre de l'environnement dev
# Usage : ./scripts/dev-stop.sh
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Détecter si LiveKit est activé pour inclure l'overlay
LIVEKIT_COMPOSE=""
if grep -qE '^LIVEKIT_ENABLED=true' .env.local 2>/dev/null; then
  LIVEKIT_COMPOSE="-f docker-compose.livekit.yml"
fi

# Détecter si Penpot est activé pour inclure l'overlay
PENPOT_COMPOSE=""
if grep -qE '^PENPOT_ENABLED=true' .env.local 2>/dev/null; then
  PENPOT_COMPOSE="-f docker-compose.penpot.yml"
fi

echo "Arret des services Docker..."
docker compose -f docker-compose.yml $LIVEKIT_COMPOSE $PENPOT_COMPOSE down

echo "Environnement dev arrete."

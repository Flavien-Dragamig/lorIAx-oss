#!/usr/bin/env bash
# ============================================================
# Build local des images Docker LorIAx + push vers GHCR.
#
# Pourquoi : `next build` sature la RAM du VPS de prod (Univer,
# Excalidraw, TipTap, ffmpeg-wasm...) → la machine thrash et le
# déploiement plante silencieusement. On build donc en local,
# on pousse l'image, et Dokploy ne fait plus que pull + run.
#
# Pré-requis (une seule fois) :
#   docker login ghcr.io -u flavien-dragamig
#   → mot de passe = PAT GitHub avec le scope `write:packages`
#
# Usage :
#   bash scripts/build-and-push.sh
#
# Puis sur Dokploy → service "Loriax App" → Redeploy.
# ============================================================
set -euo pipefail

cd "$(dirname "$0")/.."   # → loriax-app/

REGISTRY="ghcr.io/flavien-dragamig/loriax"
VERSION="$(node -p "require('./package.json').version")"

# Variables NEXT_PUBLIC_* inlinées dans les bundles client au build.
# Surchargeables via l'environnement ; valeurs prod par défaut.
NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-https://app.loriax.fr}"
NEXT_PUBLIC_ROOT_DOMAIN="${NEXT_PUBLIC_ROOT_DOMAIN:-loriax.fr}"
NEXT_PUBLIC_LICENSE_MANAGER_URL="${NEXT_PUBLIC_LICENSE_MANAGER_URL:-https://licences.loriax.fr}"
NEXT_PUBLIC_ENTERPRISE_CONTACT_URL="${NEXT_PUBLIC_ENTERPRISE_CONTACT_URL:-https://loriax.fr/enterprise/}"

export DOCKER_BUILDKIT=1

echo "▶ Version : $VERSION"
echo "▶ Build image runtime — $REGISTRY:$VERSION"
docker build \
  --target runner \
  --build-arg APP_VERSION="$VERSION" \
  --build-arg NEXT_PUBLIC_APP_URL="$NEXT_PUBLIC_APP_URL" \
  --build-arg NEXT_PUBLIC_ROOT_DOMAIN="$NEXT_PUBLIC_ROOT_DOMAIN" \
  --build-arg NEXT_PUBLIC_LICENSE_MANAGER_URL="$NEXT_PUBLIC_LICENSE_MANAGER_URL" \
  --build-arg NEXT_PUBLIC_ENTERPRISE_CONTACT_URL="$NEXT_PUBLIC_ENTERPRISE_CONTACT_URL" \
  -t "$REGISTRY:$VERSION" \
  -t "$REGISTRY:latest" \
  .

# Image "migrate" = stage builder (contient drizzle-kit + tsx + scripts/),
# requise par le service app-migrate qui exécute scripts/init-db.ts.
# Les stages partagés sont déjà en cache → ce build est quasi instantané.
echo "▶ Build image migrate — $REGISTRY:$VERSION-migrate"
docker build \
  --target builder \
  --build-arg APP_VERSION="$VERSION" \
  -t "$REGISTRY:$VERSION-migrate" \
  -t "$REGISTRY:latest-migrate" \
  .

echo "▶ Push vers GHCR"
docker push "$REGISTRY:$VERSION"
docker push "$REGISTRY:latest"
docker push "$REGISTRY:$VERSION-migrate"
docker push "$REGISTRY:latest-migrate"

echo
echo "✓ Images publiées :"
echo "    $REGISTRY:$VERSION  (+ :latest)"
echo "    $REGISTRY:$VERSION-migrate  (+ :latest-migrate)"
echo
echo "→ Dokploy : service \"Loriax App\" → Redeploy."
echo "  (Compose Path doit pointer sur loriax-app/docker-compose.registry.yml)"

# Diagnostic des services impactés depuis le tag précédent.
SCOPE_SCRIPT="$(git rev-parse --show-toplevel)/scripts/deploy-scope.sh"
if [[ -x "$SCOPE_SCRIPT" ]]; then
  PREV_TAG="$(git describe --tags --abbrev=0 "v$VERSION^" 2>/dev/null || echo "")"
  if [[ -n "$PREV_TAG" ]]; then
    bash "$SCOPE_SCRIPT" "$PREV_TAG" "v$VERSION"
  fi
fi

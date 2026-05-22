#!/usr/bin/env bash
# Teste le flow auth complet sur app.loriax.fr :
#   1. récupère le CSRF token
#   2. POST /api/auth/callback/credentials (NextAuth) avec email/password
#   3. vérifie que les cookies __Secure-next-auth.session-token (sur app.loriax.fr)
#      et lrx_org (sur .loriax.fr) sont bien posés
#   4. appelle /api/health et /signup pour sanity-check
#
# Usage :
#   loriax-app/scripts/test-auth-flow.sh                # prod (app.loriax.fr)
#   BASE_URL=http://localhost:3000 ./test-auth-flow.sh  # local
#
# Variables attendues dans loriax-app/.env.local :
#   TEST_USER_EMAIL=claude-cli@loriax.fr
#   TEST_USER_PASSWORD=...

set -euo pipefail

BASE_URL="${BASE_URL:-https://app.loriax.fr}"
ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/.env.local"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ $ENV_FILE introuvable — créer ce fichier (gitignored) avec :"
  echo "   TEST_USER_EMAIL=..."
  echo "   TEST_USER_PASSWORD=..."
  exit 1
fi

# shellcheck disable=SC1090
TEST_USER_EMAIL=$(grep -E '^TEST_USER_EMAIL=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
TEST_USER_PASSWORD=$(grep -E '^TEST_USER_PASSWORD=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")

if [ -z "${TEST_USER_EMAIL:-}" ] || [ -z "${TEST_USER_PASSWORD:-}" ]; then
  echo "❌ TEST_USER_EMAIL / TEST_USER_PASSWORD manquant dans $ENV_FILE"
  exit 1
fi

JAR=$(mktemp -t loriax-auth-XXXX.jar)
trap 'rm -f "$JAR"' EXIT

echo "▶ Base URL : $BASE_URL"
echo "▶ User     : $TEST_USER_EMAIL"

echo
echo "── 1. CSRF token"
CSRF_JSON=$(curl -s -c "$JAR" -b "$JAR" "$BASE_URL/api/auth/csrf")
CSRF_TOKEN=$(printf '%s' "$CSRF_JSON" | sed -nE 's/.*"csrfToken":"([^"]+)".*/\1/p')
if [ -z "$CSRF_TOKEN" ]; then
  echo "❌ Échec récupération CSRF : $CSRF_JSON"
  exit 1
fi
echo "  ✔ csrfToken obtenu (${#CSRF_TOKEN} chars)"

echo
echo "── 2. POST /api/auth/callback/credentials"
HTTP_CODE=$(curl -s -o /tmp/auth-resp.txt -w "%{http_code}" \
  -c "$JAR" -b "$JAR" \
  -X POST "$BASE_URL/api/auth/callback/credentials" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "csrfToken=$CSRF_TOKEN" \
  --data-urlencode "email=$TEST_USER_EMAIL" \
  --data-urlencode "password=$TEST_USER_PASSWORD" \
  --data-urlencode "callbackUrl=$BASE_URL/" \
  --data-urlencode "json=true")
echo "  HTTP $HTTP_CODE"
if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "302" ]; then
  echo "  ⚠ Réponse :"
  cat /tmp/auth-resp.txt
fi

echo
echo "── 3. Cookies posés"
SESSION_COOKIE=$(grep -E "__Secure-next-auth.session-token|next-auth.session-token" "$JAR" || true)
ORG_COOKIE=$(grep -E "(^|\s)lrx_org\s" "$JAR" || true)

if [ -n "$SESSION_COOKIE" ]; then
  echo "  ✔ session-token présent"
else
  echo "  ❌ session-token absent — auth échouée"
fi

if [ -n "$ORG_COOKIE" ]; then
  echo "  ✔ lrx_org présent : $(printf '%s' "$ORG_COOKIE" | awk '{print $1"  "$NF}')"
else
  echo "  ⚠ lrx_org pas encore posé (sera posé au prochain GET HTML côté middleware)"
fi

echo
echo "── 4. GET / pour déclencher syncOrgCookie()"
curl -s -o /dev/null -c "$JAR" -b "$JAR" "$BASE_URL/"
ORG_COOKIE=$(grep -E "(^|\s)lrx_org\s" "$JAR" || true)
if [ -n "$ORG_COOKIE" ]; then
  SLUG=$(printf '%s' "$ORG_COOKIE" | awk '{print $NF}')
  echo "  ✔ lrx_org : $SLUG  (domaine $(printf '%s' "$ORG_COOKIE" | awk '{print $1}'))"
else
  echo "  ❌ lrx_org toujours absent après GET / — middleware ne pose pas le cookie"
fi

echo
echo "── 5. Sanity"
echo -n "  /api/health : "
curl -s "$BASE_URL/api/health" | head -c 200
echo
echo -n "  /signup HTTP : "
curl -s -o /dev/null -w "%{http_code}\n" -b "$JAR" "$BASE_URL/signup"
echo
echo "✅ Flow testé. Cookie jar éphémère, supprimé en sortie."

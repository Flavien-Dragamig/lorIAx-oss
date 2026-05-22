#!/bin/sh
# Initialisation idempotente de Garage S3.
# - Attend que le démon Garage soit prêt
# - Assigne un rôle au nœud unique si pas encore fait (layout)
# - Importe la clé S3 fournie par l'environnement (S3_ACCESS_KEY/S3_SECRET_KEY)
# - Crée le bucket loriax-files si absent
# - Accorde les permissions read/write/owner à la clé sur le bucket
#
# Échoue immédiatement (set -e) si une étape critique rate. Aucun `|| true`
# silencieux : un déploiement cassé doit se voir.
set -eu

CFG=/etc/garage-client.toml
GARAGE="garage -c $CFG"

echo "==> Attente de Garage…"
for i in $(seq 1 60); do
  if $GARAGE stats >/dev/null 2>&1; then
    break
  fi
  sleep 1
  if [ "$i" -eq 60 ]; then
    echo "ERREUR: Garage ne répond pas après 60s" >&2
    exit 1
  fi
done

echo "==> Vérification du layout…"
NODE_ID=$($GARAGE node id -q | cut -d@ -f1)
if $GARAGE layout show 2>/dev/null | grep -q "$NODE_ID"; then
  echo "    layout déjà configuré pour $NODE_ID"
else
  echo "    assignation d'un rôle au nœud $NODE_ID"
  $GARAGE layout assign -z dc1 -c 10G "$NODE_ID"
  CURRENT_VERSION=$($GARAGE layout show 2>&1 | awk '/Current cluster layout version/ {print $NF}')
  NEXT_VERSION=$((CURRENT_VERSION + 1))
  $GARAGE layout apply --version "$NEXT_VERSION"
fi

echo "==> Validation du format de S3_ACCESS_KEY…"
# Garage exige un identifiant de clé au format `GK` + 24 caractères hexadécimaux.
# Toute autre valeur (UUID, mot de passe générique) est rejetée par `key import`.
if ! echo "$S3_ACCESS_KEY" | grep -Eq '^GK[0-9a-f]{24}$'; then
  cat >&2 <<EOF
ERREUR: S3_ACCESS_KEY invalide.
        Format attendu: GK + 24 caractères hexadécimaux (ex: GK1a2b3c4d5e6f7890abcdef12).
        Génère une paire valide :
          S3_ACCESS_KEY="GK\$(openssl rand -hex 12)"
          S3_SECRET_KEY="\$(openssl rand -hex 32)"
EOF
  exit 1
fi

echo "==> Import de la clé S3…"
if $GARAGE key info "$S3_ACCESS_KEY" >/dev/null 2>&1; then
  echo "    clé $S3_ACCESS_KEY déjà importée"
else
  $GARAGE key import "$S3_ACCESS_KEY" "$S3_SECRET_KEY" --yes
fi

echo "==> Création du bucket loriax-files…"
if $GARAGE bucket info loriax-files >/dev/null 2>&1; then
  echo "    bucket déjà présent"
else
  $GARAGE bucket create loriax-files
fi

echo "==> Autorisation de la clé sur le bucket…"
$GARAGE bucket allow --read --write --owner loriax-files --key "$S3_ACCESS_KEY"

echo "✓ Garage initialisé"

#!/usr/bin/env bash
# =============================================================
# system-cleanup.sh — Nettoyage système + réparation swap
# Asus ExpertBook — Diagnostic du 2026-03-17
#
# Usage : sudo bash scripts/system-cleanup.sh
# =============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }

if [ "$EUID" -ne 0 ]; then
  err "Ce script doit être lancé avec sudo"
  exit 1
fi

echo "========================================"
echo "  Nettoyage système — $(date +%Y-%m-%d)"
echo "========================================"
echo ""

BEFORE=$(df / --output=avail | tail -1)

# ---------------------------------------------------------
# 1. Suppression des vieux noyaux
# ---------------------------------------------------------
echo "--- 1/5 Noyaux Linux ---"
CURRENT=$(uname -r)
log "Noyau actuel : $CURRENT"

OLD_KERNELS=$(dpkg --list 'linux-image-*' | grep ^ii | awk '{print $2}' | grep -v "$CURRENT" | grep -v "generic$" || true)
if [ -n "$OLD_KERNELS" ]; then
  COUNT=$(echo "$OLD_KERNELS" | wc -l)
  warn "Suppression de $COUNT vieux noyaux..."
  for k in $OLD_KERNELS; do
    echo "  - $k"
  done
  echo "$OLD_KERNELS" | xargs apt-get purge -y --quiet 2>&1 | tail -3
  apt-get autoremove -y --quiet 2>&1 | tail -3
  log "Vieux noyaux supprimés"
else
  log "Aucun vieux noyau à supprimer"
fi
echo ""

# ---------------------------------------------------------
# 2. Cache APT
# ---------------------------------------------------------
echo "--- 2/5 Cache APT ---"
APT_SIZE=$(du -sh /var/cache/apt/archives/ 2>/dev/null | cut -f1)
warn "Cache APT : $APT_SIZE"
apt-get clean
log "Cache APT nettoyé"
echo ""

# ---------------------------------------------------------
# 3. Journaux système
# ---------------------------------------------------------
echo "--- 3/5 Journaux système ---"
JOURNAL_SIZE=$(journalctl --disk-usage 2>/dev/null | grep -oP '[\d.]+\s*\w+' | head -1)
warn "Journaux avant : $JOURNAL_SIZE"
journalctl --vacuum-size=200M 2>&1 | tail -2
log "Journaux limités à 200 Mo"

# Configurer la limite permanente
if ! grep -q "SystemMaxUse=200M" /etc/systemd/journald.conf 2>/dev/null; then
  echo "SystemMaxUse=200M" >> /etc/systemd/journald.conf
  systemctl restart systemd-journald
  log "Limite permanente configurée dans journald.conf"
fi
echo ""

# ---------------------------------------------------------
# 4. Docker (images non utilisées)
# ---------------------------------------------------------
echo "--- 4/5 Docker ---"
if command -v docker &>/dev/null; then
  DOCKER_BEFORE=$(docker system df --format '{{.Size}}' 2>/dev/null | head -1)
  warn "Images Docker avant : $DOCKER_BEFORE"
  docker image prune -f 2>&1 | tail -2
  log "Images Docker inutilisées supprimées"
else
  log "Docker non installé, rien à faire"
fi
echo ""

# ---------------------------------------------------------
# 5. Réparation swap (2 Go)
# ---------------------------------------------------------
echo "--- 5/5 Swap ---"
if swapon --show | grep -q "/swapfile"; then
  log "Swap déjà actif"
else
  warn "Swap inactif — réparation en cours..."

  # Désactiver au cas où
  swapoff /swapfile 2>/dev/null || true

  # Recréer le swapfile proprement
  # (l'ancien peut être corrompu ou mal formaté après un resize/copie)
  rm -f /swapfile
  fallocate -l 4G /swapfile  # 4 Go pour 16 Go RAM (recommandation kernel)
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile

  # Vérifier le fstab
  if ! grep -q "swapfile" /etc/fstab; then
    echo "/swapfile none swap sw 0 0" >> /etc/fstab
    log "Entrée fstab ajoutée"
  fi

  log "Swap 4 Go créé et activé"
fi

SWAP_STATUS=$(swapon --show --noheadings 2>/dev/null)
if [ -n "$SWAP_STATUS" ]; then
  log "Swap actif : $(swapon --show --noheadings | awk '{print $3}')"
else
  err "Swap toujours inactif — vérifier manuellement"
fi
echo ""

# ---------------------------------------------------------
# Bilan
# ---------------------------------------------------------
echo "========================================"
echo "  Bilan"
echo "========================================"
AFTER=$(df / --output=avail | tail -1)
FREED=$(( (AFTER - BEFORE) / 1024 ))
echo ""
log "Espace libéré sur / : ${FREED} Mo"
echo ""
df -h / /home
echo ""
free -h
echo ""
log "Terminé ! Redémarrage recommandé pour vérifier le swap au boot."

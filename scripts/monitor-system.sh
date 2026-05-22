#!/usr/bin/env bash
# =============================================================
# monitor-system.sh — Monitoring système léger
# Affiche un résumé rapide de la santé de la machine
#
# Usage :
#   ./scripts/monitor-system.sh          # snapshot unique
#   ./scripts/monitor-system.sh --watch  # rafraîchi toutes les 10s
#   ./scripts/monitor-system.sh --log    # écrit dans /tmp/system-monitor.log
# =============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

status_color() {
  local val=$1 warn=$2 crit=$3
  if (( $(echo "$val >= $crit" | bc -l) )); then
    echo -e "${RED}${val}${NC}"
  elif (( $(echo "$val >= $warn" | bc -l) )); then
    echo -e "${YELLOW}${val}${NC}"
  else
    echo -e "${GREEN}${val}${NC}"
  fi
}

snapshot() {
  local NOW
  NOW=$(date '+%Y-%m-%d %H:%M:%S')

  # CPU temp
  local CPU_TEMP="?"
  if command -v sensors &>/dev/null; then
    CPU_TEMP=$(sensors 2>/dev/null | grep "Package id 0" | grep -oP '\+\K[\d.]+' | head -1)
  fi

  # Fan
  local FAN="?"
  if command -v sensors &>/dev/null; then
    FAN=$(sensors 2>/dev/null | grep "fan" | grep -oP '[\d]+(?= RPM)' | head -1)
  fi

  # Mémoire
  local MEM_TOTAL MEM_USED MEM_PCT
  MEM_TOTAL=$(free -m | awk '/Mem:/{print $2}')
  MEM_USED=$(free -m | awk '/Mem:/{print $3}')
  MEM_PCT=$(( MEM_USED * 100 / MEM_TOTAL ))

  # Swap
  local SWAP_INFO
  SWAP_INFO=$(swapon --show --noheadings 2>/dev/null | awk '{print $3, "(" $5 ")"}')
  if [ -z "$SWAP_INFO" ]; then
    SWAP_INFO="${RED}INACTIF${NC}"
  fi

  # Disque /
  local DISK_PCT
  DISK_PCT=$(df / --output=pcent | tail -1 | tr -d ' %')

  # Disque /home
  local HOME_PCT
  HOME_PCT=$(df /home --output=pcent | tail -1 | tr -d ' %')

  # Load
  local LOAD
  LOAD=$(cat /proc/loadavg | awk '{print $1, $2, $3}')

  # Inotify
  local INOTIFY_MAX INOTIFY_USED
  INOTIFY_MAX=$(cat /proc/sys/fs/inotify/max_user_watches)
  INOTIFY_USED=$(cat /proc/sys/fs/inotify/max_user_instances 2>/dev/null || echo "?")
  # Comptage réel des instances inotify (tolérant aux PIDs qui disparaissent)
  INOTIFY_USED=$(ls -la /proc/*/fd/* 2>/dev/null | grep -c "anon_inode:inotify" || true)

  # Top 3 CPU
  local TOP_CPU
  TOP_CPU=$(ps aux --sort=-%cpu | awk 'NR>1 && NR<=4 {printf "    %-20s %5s%% CPU  %5s%% MEM\n", $11, $3, $4}')

  # Top 3 MEM
  local TOP_MEM
  TOP_MEM=$(ps aux --sort=-%mem | awk 'NR>1 && NR<=4 {printf "    %-20s %5s%% MEM  %s Mo RSS\n", $11, $4, int($6/1024)}')

  # Output
  echo -e "${BOLD}═══ Monitoring système — $NOW ═══${NC}"
  echo ""
  echo -e "  ${CYAN}CPU${NC}     Temp: $(status_color "$CPU_TEMP" 70 85)°C    Fan: ${FAN} RPM    Load: $LOAD"
  echo -e "  ${CYAN}RAM${NC}     ${MEM_USED}/${MEM_TOTAL} Mo ($(status_color "$MEM_PCT" 75 90)%)"
  echo -e "  ${CYAN}Swap${NC}    $SWAP_INFO"
  echo -e "  ${CYAN}Disque${NC}  /: $(status_color "$DISK_PCT" 80 90)%    /home: $(status_color "$HOME_PCT" 80 90)%"
  echo -e "  ${CYAN}Inotify${NC} ${INOTIFY_USED}/${INOTIFY_MAX} instances"
  echo ""
  echo -e "  ${BOLD}Top CPU :${NC}"
  echo "$TOP_CPU"
  echo ""
  echo -e "  ${BOLD}Top MEM :${NC}"
  echo "$TOP_MEM"
  echo ""

  # Alertes
  local ALERTS=0
  if (( DISK_PCT >= 90 )); then
    echo -e "  ${RED}⚠ ALERTE : partition / à ${DISK_PCT}% — libérer de l'espace !${NC}"
    ALERTS=$((ALERTS + 1))
  fi
  if [ -z "$(swapon --show --noheadings 2>/dev/null)" ]; then
    echo -e "  ${RED}⚠ ALERTE : swap inactif — risque de freeze si pic mémoire !${NC}"
    ALERTS=$((ALERTS + 1))
  fi
  if (( $(echo "$CPU_TEMP >= 85" | bc -l 2>/dev/null || echo 0) )); then
    echo -e "  ${RED}⚠ ALERTE : CPU à ${CPU_TEMP}°C — surchauffe !${NC}"
    ALERTS=$((ALERTS + 1))
  fi
  if (( MEM_PCT >= 90 )); then
    echo -e "  ${YELLOW}⚠ ATTENTION : RAM à ${MEM_PCT}% — fermer des applications${NC}"
    ALERTS=$((ALERTS + 1))
  fi
  if (( ALERTS == 0 )); then
    echo -e "  ${GREEN}✓ Tout est normal${NC}"
  fi
  echo ""
}

snapshot_log() {
  local NOW CPU_TEMP MEM_PCT DISK_PCT SWAP_ACTIVE LOAD
  NOW=$(date '+%Y-%m-%d %H:%M:%S')
  CPU_TEMP=$(sensors 2>/dev/null | grep "Package id 0" | grep -oP '\+\K[\d.]+' | head -1 || echo "?")
  MEM_PCT=$(free | awk '/Mem:/{printf "%.0f", $3/$2*100}')
  DISK_PCT=$(df / --output=pcent | tail -1 | tr -d ' %')
  SWAP_ACTIVE=$(swapon --show --noheadings 2>/dev/null | wc -l)
  LOAD=$(cat /proc/loadavg | awk '{print $1}')
  echo "$NOW,cpu_temp=$CPU_TEMP,mem=$MEM_PCT%,disk=$DISK_PCT%,swap_active=$SWAP_ACTIVE,load=$LOAD"
}

case "${1:-}" in
  --watch)
    while true; do
      clear
      snapshot
      sleep 10
    done
    ;;
  --log)
    LOG="${2:-/tmp/system-monitor.log}"
    echo "timestamp,cpu_temp,mem_pct,disk_pct,swap_active,load_1m" > "$LOG"
    echo "Logging vers $LOG (Ctrl+C pour arrêter)"
    while true; do
      snapshot_log >> "$LOG"
      sleep 10
    done
    ;;
  *)
    snapshot
    ;;
esac

"use client";

import { WifiOff } from "lucide-react";
import { useNetworkStatus } from "@/hooks/use-network-status";

export function NetworkStatusBanner() {
  const { isOnline, isServerReachable } = useNetworkStatus();

  if (isOnline && isServerReachable) return null;

  const message = !isOnline
    ? "Mode hors ligne — vos modifications sont sauvegardées localement et seront synchronisées automatiquement"
    : "Le serveur est injoignable — reconnexion en cours\u2026";

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

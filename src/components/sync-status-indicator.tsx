"use client";

import { Check, Circle, Loader2, X } from "lucide-react";
import type { SyncStatus } from "@/hooks/use-sync-status";

interface SyncStatusIndicatorProps {
  syncStatus: SyncStatus;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTooltip(syncStatus: SyncStatus): string {
  switch (syncStatus.status) {
    case "synced":
      return syncStatus.lastSyncedAt
        ? `Synchronise a ${formatTime(syncStatus.lastSyncedAt)}`
        : "Synchronise";
    case "local-changes":
      return syncStatus.pendingChanges > 0
        ? `${syncStatus.pendingChanges} modification${syncStatus.pendingChanges > 1 ? "s" : ""} en attente`
        : "Modifications locales non synchronisees";
    case "syncing":
      return "Synchronisation en cours\u2026";
    case "error":
      return "Erreur de synchronisation — une nouvelle tentative sera effectuee automatiquement";
  }
}

export function SyncStatusIndicator({ syncStatus }: SyncStatusIndicatorProps) {
  const tooltip = getTooltip(syncStatus);

  return (
    <div
      className="flex items-center gap-1"
      title={tooltip}
      role="status"
      aria-label={tooltip}
    >
      {syncStatus.status === "synced" && (
        <Check className="h-3.5 w-3.5 text-green-500" />
      )}
      {syncStatus.status === "local-changes" && (
        <div className="flex items-center gap-1">
          <Circle className="h-3 w-3 fill-amber-500 text-amber-500" />
          {syncStatus.pendingChanges > 0 && (
            <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
              {syncStatus.pendingChanges}
            </span>
          )}
        </div>
      )}
      {syncStatus.status === "syncing" && (
        <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
      )}
      {syncStatus.status === "error" && (
        <X className="h-3.5 w-3.5 text-destructive" />
      )}
    </div>
  );
}

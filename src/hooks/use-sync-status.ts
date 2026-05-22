"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import { syncManager } from "@/lib/offline/sync-manager";
import { countAll } from "@/lib/offline/pending-queue";

export interface SyncStatus {
  status: "synced" | "local-changes" | "syncing" | "error";
  pendingChanges: number;
  lastSyncedAt: Date | null;
}

interface UseSyncStatusOptions {
  provider: HocuspocusProvider | null;
  isConnected: boolean;
  isSynced: boolean;
  /** Number of Yjs updates not yet sent to the server */
  pendingUpdates?: number;
}

/**
 * Hook tracking the synchronization state of a document.
 *
 * State machine:
 *   synced ──(offline edit)──→ local-changes ──(reconnect)──→ syncing ──(success)──→ synced
 *                                                                 │
 *                                                             (failure)──→ error
 */
export function useSyncStatus({
  provider,
  isConnected,
  isSynced,
  pendingUpdates = 0,
}: UseSyncStatusOptions): SyncStatus {
  const [status, setStatus] = useState<SyncStatus["status"]>("synced");
  const [pendingChanges, setPendingChanges] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const wasConnectedRef = useRef(isConnected);

  // Poll pending operations count
  const refreshPendingCount = useCallback(async () => {
    try {
      const total = await countAll();
      setPendingChanges(total + pendingUpdates);
    } catch {
      setPendingChanges(pendingUpdates);
    }
  }, [pendingUpdates]);

  // Transition logic based on connection and sync state
  useEffect(() => {
    if (isConnected && isSynced) {
      setStatus("synced");
      setLastSyncedAt(new Date());
      wasConnectedRef.current = true;
      return;
    }

    if (isConnected && !isSynced) {
      // Connected but not yet synced — syncing in progress
      setStatus("syncing");
      wasConnectedRef.current = true;
      return;
    }

    if (!isConnected && wasConnectedRef.current) {
      // Was connected, now disconnected — local changes mode
      setStatus("local-changes");
      wasConnectedRef.current = false;
      return;
    }

    // Not connected and was never connected — initial state
    if (!isConnected) {
      setStatus("local-changes");
    }
  }, [isConnected, isSynced]);

  // Listen to SyncManager events for queue flush status
  useEffect(() => {
    const unsubs: Array<() => void> = [];

    unsubs.push(
      syncManager.on("flush-start", () => {
        setStatus("syncing");
      }),
    );

    unsubs.push(
      syncManager.on("flush-complete", ({ synced, failed }) => {
        if (failed > 0) {
          setStatus("error");
        } else if (synced > 0 && isConnected && isSynced) {
          setStatus("synced");
          setLastSyncedAt(new Date());
        }
        refreshPendingCount();
      }),
    );

    unsubs.push(
      syncManager.on("flush-error", () => {
        setStatus("error");
      }),
    );

    return () => unsubs.forEach((fn) => fn());
  }, [isConnected, isSynced, refreshPendingCount]);

  // Refresh pending count on mount and when relevant state changes
  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount, status]);

  // Listen to online/offline events for immediate status updates
  useEffect(() => {
    function handleOffline() {
      setStatus("local-changes");
    }

    function handleOnline() {
      if (provider && !isConnected) {
        setStatus("syncing");
      }
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [provider, isConnected]);

  return { status, pendingChanges, lastSyncedAt };
}

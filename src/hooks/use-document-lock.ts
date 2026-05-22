"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface LockState {
  isLocked: boolean;
  lockedBy: string | null;
  lockedByName: string | null;
  isOwner: boolean;
}

interface UseDocumentLockReturn extends LockState {
  lockDocument: () => Promise<boolean>;
  unlockDocument: () => Promise<void>;
}

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function useDocumentLock(documentId: string): UseDocumentLockReturn {
  const [lockState, setLockState] = useState<LockState>({
    isLocked: false,
    lockedBy: null,
    lockedByName: null,
    isOwner: false,
  });

  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isOwnerRef = useRef(false);
  const documentIdRef = useRef(documentId);

  // Garder la ref à jour
  useEffect(() => {
    documentIdRef.current = documentId;
  }, [documentId]);

  const lockDocument = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`/api/documents/${documentIdRef.current}/lock`, {
        method: "POST",
      });

      if (res.ok) {
        setLockState({
          isLocked: true,
          lockedBy: null,
          lockedByName: null,
          isOwner: true,
        });
        isOwnerRef.current = true;
        return true;
      }

      if (res.status === 409) {
        const data = await res.json();
        setLockState({
          isLocked: true,
          lockedBy: data.lockedBy,
          lockedByName: data.lockedByName,
          isOwner: false,
        });
        isOwnerRef.current = false;
        return false;
      }

      return false;
    } catch (error) {
      console.error('[useDocumentLock] Verrouillage document échoué:', error);
      return false;
    }
  }, []);

  const unlockDocument = useCallback(async (): Promise<void> => {
    if (!isOwnerRef.current) return;

    try {
      await fetch(`/api/documents/${documentIdRef.current}/lock`, {
        method: "DELETE",
      });
    } catch (error) {
      console.error('[useDocumentLock] Déverrouillage document échoué:', error);
    }

    isOwnerRef.current = false;
    setLockState({
      isLocked: false,
      lockedBy: null,
      lockedByName: null,
      isOwner: false,
    });
  }, []);

  const sendHeartbeat = useCallback(async () => {
    if (!isOwnerRef.current) return;

    try {
      const res = await fetch(`/api/documents/${documentIdRef.current}/lock`, {
        method: "PATCH",
      });

      if (!res.ok) {
        // Le verrou a été perdu
        isOwnerRef.current = false;
        setLockState((prev) => ({ ...prev, isOwner: false }));
      }
    } catch (error) {
      console.error('[useDocumentLock] Heartbeat verrou échoué:', error);
      // Réseau indisponible — on garde le verrou localement
    }
  }, []);

  // Acquérir le verrou au mount, libérer au unmount
  useEffect(() => {
    if (!documentId) return;

    lockDocument();

    // Heartbeat toutes les 5 minutes
    heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      // Libérer le verrou au unmount
      if (isOwnerRef.current) {
        const url = `/api/documents/${documentIdRef.current}/lock`;
        fetch(url, { method: "DELETE", keepalive: true }).catch((error) => {
          console.error('[useDocumentLock] Déverrouillage au unmount échoué:', error);
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  // beforeunload — libérer le verrou si la fenêtre est fermée
  useEffect(() => {
    function handleBeforeUnload() {
      if (!isOwnerRef.current) return;
      const url = `/api/documents/${documentIdRef.current}/lock`;
      fetch(url, { method: "DELETE", keepalive: true }).catch((error) => {
        console.error('[useDocumentLock] Déverrouillage beforeunload échoué:', error);
      });
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  return {
    ...lockState,
    lockDocument,
    unlockDocument,
  };
}

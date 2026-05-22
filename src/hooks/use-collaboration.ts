"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";

interface UseCollaborationOptions {
  documentId: string;
  token: string;
  enabled?: boolean;
}

interface CollaborationState {
  provider: HocuspocusProvider | null;
  ydoc: Y.Doc | null;
  isConnected: boolean;
  isSynced: boolean;
  connectionError: string | null;
  /** Number of Yjs updates buffered locally (not yet sent to server) */
  pendingUpdates: number;
  /** True dès que IndexedDB a restauré le document Yjs (~50-100ms, avant la synchro WebSocket) */
  ydocReady: boolean;
}

export function useCollaboration({
  documentId,
  token,
  enabled = true,
}: UseCollaborationOptions): CollaborationState {
  const [isConnected, setIsConnected] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [pendingUpdates, setPendingUpdates] = useState(0);
  const [ydocReady, setYdocReady] = useState(false);
  const providerRef = useRef<HocuspocusProvider | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const idbPersistenceRef = useRef<IndexeddbPersistence | null>(null);

  const cleanup = useCallback(() => {
    if (providerRef.current) {
      providerRef.current.destroy();
      providerRef.current = null;
    }
    if (idbPersistenceRef.current) {
      idbPersistenceRef.current.destroy();
      idbPersistenceRef.current = null;
    }
    if (ydocRef.current) {
      ydocRef.current.destroy();
      ydocRef.current = null;
    }
    setIsConnected(false);
    setIsSynced(false);
    setPendingUpdates(0);
    setYdocReady(false);
  }, []);

  useEffect(() => {
    if (!enabled || !documentId || !token) {
      cleanup();
      return;
    }

    let mounted = true;

    // Create Yjs document
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // Persist Y.Doc in IndexedDB for offline reading
    const idbPersistence = new IndexeddbPersistence(`loriax-doc-${documentId}`, ydoc);
    idbPersistenceRef.current = idbPersistence;

    // Signal dès que IndexedDB a restauré le contenu Yjs (avant la synchro WebSocket)
    // Guard against calling setState after unmount (fast document navigation)
    idbPersistence.whenSynced.then(() => {
      if (mounted) setYdocReady(true);
    });

    // Determine WebSocket URL
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/collab`;

    // Track local Yjs updates that haven't been synced
    let localPending = 0;
    const handleYjsUpdate = (_update: Uint8Array, origin: unknown) => {
      // Updates originating from the provider (server) are not "pending"
      if (origin !== provider) {
        localPending++;
        setPendingUpdates(localPending);
      }
    };
    ydoc.on("update", handleYjsUpdate);

    // Create Hocuspocus provider
    const provider = new HocuspocusProvider({
      url: wsUrl,
      name: documentId,
      document: ydoc,
      token,
      onConnect() {
        setIsConnected(true);
        setConnectionError(null);
      },
      onDisconnect() {
        setIsConnected(false);
        setIsSynced(false);
      },
      onSynced() {
        setIsSynced(true);
        // Once synced, all buffered updates have been sent
        localPending = 0;
        setPendingUpdates(0);
      },
      onAuthenticationFailed(data) {
        const reason = data.reason;
        // Hocuspocus renvoie "permission-denied" par défaut — on traduit en français
        if (reason === "permission-denied" || reason === "Accès refusé") {
          setConnectionError("Accès refusé — vous n'avez pas les droits sur ce document");
        } else if (reason === "Non autorisé") {
          setConnectionError("Session expirée — veuillez recharger la page");
        } else {
          setConnectionError(reason || "Erreur d'authentification");
        }
      },
    });

    providerRef.current = provider;

    return () => {
      mounted = false;
      cleanup();
    };
  }, [documentId, token, enabled, cleanup]);

  return {
    provider: providerRef.current,
    ydoc: ydocRef.current,
    isConnected,
    isSynced,
    connectionError,
    pendingUpdates,
    ydocReady,
  };
}

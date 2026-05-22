import { useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";

const LOCK_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface UseBlockLockOptions {
  lockedBy?: string | null;
  lockedAt?: string | null;
  modalOpen: boolean;
  updateAttributes: (attrs: Record<string, string | null>) => void;
}

interface UseBlockLockReturn {
  isLockedByOther: boolean;
  acquireLock: () => void;
  releaseLock: () => void;
}

/**
 * Hook partagé pour la gestion du verrou optimiste sur les blocs éditeur
 * (whiteboard, mindmap, penpot, etc.).
 *
 * Gère :
 * - le calcul `isLockedByOther` (verrou tenu par un autre utilisateur non expiré)
 * - l'acquisition du verrou (pose userId + timestamp)
 * - la libération du verrou (efface les attributs)
 * - la libération automatique à la fermeture du navigateur
 */
export function useBlockLock({
  lockedBy,
  lockedAt,
  modalOpen,
  updateAttributes,
}: UseBlockLockOptions): UseBlockLockReturn {
  const { data: session } = useSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  const isLockExpired = lockedAt
    ? Date.now() - new Date(lockedAt).getTime() > LOCK_TTL_MS
    : true;

  const isLockedByOther = Boolean(lockedBy && lockedBy !== userId && !isLockExpired);

  const acquireLock = useCallback(() => {
    updateAttributes({
      lockedBy: userId ?? null,
      lockedAt: new Date().toISOString(),
    });
  }, [userId, updateAttributes]);

  const releaseLock = useCallback(() => {
    updateAttributes({ lockedBy: null, lockedAt: null });
  }, [updateAttributes]);

  // Libérer le verrou si le navigateur se ferme pendant qu'une modale est ouverte
  useEffect(() => {
    if (!modalOpen) return;
    const handleBeforeUnload = () => releaseLock();
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [modalOpen, releaseLock]);

  return { isLockedByOther, acquireLock, releaseLock };
}

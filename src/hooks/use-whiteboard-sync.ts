"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

const SAVE_DEBOUNCE_MS = 3000;

export function useWhiteboardSync(canvasId: string) {
  const [initialElements, setInitialElements] = useState<ExcalidrawElement[] | null>(null);
  const [isSynced, setIsSynced] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingElementsRef = useRef<readonly ExcalidrawElement[] | null>(null);

  useEffect(() => {
    // Charger les éléments depuis l'API REST
    fetch(`/api/whiteboard/${canvasId}`)
      .then((r) => r.json())
      .then((data) => {
        setInitialElements(Array.isArray(data.elements) ? data.elements : []);
        setIsSynced(true);
      })
      .catch(() => {
        setInitialElements([]);
        setIsSynced(true);
      });

    return () => {
      // Flush immédiat des modifications en attente à la fermeture
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (pendingElementsRef.current !== null) {
        fetch(`/api/whiteboard/${canvasId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ elements: pendingElementsRef.current }),
          keepalive: true,
        }).catch(() => {});
      }
    };
  }, [canvasId]);

  const onExcalidrawChange = useCallback(
    (elements: readonly ExcalidrawElement[]) => {
      pendingElementsRef.current = elements;

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        pendingElementsRef.current = null;
        fetch(`/api/whiteboard/${canvasId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ elements }),
        }).catch((err) => {
          if (process.env.NODE_ENV === "development") {
            console.warn("[whiteboard] Erreur sauvegarde:", err);
          }
        });
      }, SAVE_DEBOUNCE_MS);
    },
    [canvasId]
  );

  return { initialElements, onExcalidrawChange, isSynced };
}

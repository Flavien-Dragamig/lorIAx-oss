"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const STORAGE_KEY_WIDTH = "loriax-sidebar-width";
const STORAGE_KEY_COLLAPSED = "loriax-sidebar-collapsed";
const DEFAULT_WIDTH = 256;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

// Initialisation synchrone depuis localStorage (évite le flash post-hydratation)
function getInitialWidth(): number {
  if (typeof window === "undefined") return DEFAULT_WIDTH;
  try {
    const saved = localStorage.getItem(STORAGE_KEY_WIDTH);
    if (saved) {
      const w = parseInt(saved, 10);
      if (w >= MIN_WIDTH && w <= MAX_WIDTH) return w;
    }
  } catch { /* SSR ou localStorage indisponible */ }
  return DEFAULT_WIDTH;
}

function getInitialCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY_COLLAPSED) === "true";
  } catch { return false; }
}

export function useSidebarResize() {
  // Toujours démarrer avec les valeurs par défaut pour correspondre au SSR
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [collapsed, setCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const widthBeforeCollapse = useRef(DEFAULT_WIDTH);
  const hydrated = useRef(false);

  // Synchroniser depuis localStorage après le montage (évite le mismatch d'hydratation)
  useEffect(() => {
    const savedWidth = getInitialWidth();
    const savedCollapsed = getInitialCollapsed();
    setWidth(savedWidth);
    setCollapsed(savedCollapsed);
    widthBeforeCollapse.current = savedWidth;
    hydrated.current = true;
  }, []);

  // Persister la largeur
  useEffect(() => {
    if (!hydrated.current) return;
    if (!collapsed) {
      localStorage.setItem(STORAGE_KEY_WIDTH, String(width));
    }
  }, [width, collapsed]);

  // Persister l'état plié
  useEffect(() => {
    if (!hydrated.current) return;
    localStorage.setItem(STORAGE_KEY_COLLAPSED, String(collapsed));
  }, [collapsed]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      if (prev) {
        // On déplie : restaurer la largeur mémorisée
        setWidth(widthBeforeCollapse.current);
      } else {
        // On plie : mémoriser la largeur actuelle
        widthBeforeCollapse.current = width;
      }
      return !prev;
    });
  }, [width]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (collapsed) return;
      e.preventDefault();
      setIsDragging(true);

      const startX = e.clientX;
      const startWidth = width;

      const handleMouseMove = (e: MouseEvent) => {
        const delta = e.clientX - startX;
        const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));
        setWidth(newWidth);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [width, collapsed]
  );

  const handleDoubleClick = useCallback(() => {
    setWidth(DEFAULT_WIDTH);
    widthBeforeCollapse.current = DEFAULT_WIDTH;
  }, []);

  return {
    width: collapsed ? 0 : width,
    collapsed,
    isDragging,
    toggleCollapsed,
    handleMouseDown,
    handleDoubleClick,
  };
}

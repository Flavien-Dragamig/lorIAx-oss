"use client";

import { useState, useEffect, useCallback, useMemo, createContext, useContext, type ReactNode } from "react";

export type EntityType = 'document' | 'space' | 'template' | 'calendar_event' | 'meeting';

export interface ResolvedFavorite {
  id: string;
  entityType: EntityType;
  entityId: string;
  position: number;
  title: string;
  icon?: string | null;
  href: string;
  badge?: string;
  subtitle?: string;
}

interface UseFavoritesReturn {
  favorites: ResolvedFavorite[];
  isLoading: boolean;
  isFavorite: (entityType: EntityType, entityId: string) => boolean;
  toggleFavorite: (entityType: EntityType, entityId: string) => Promise<void>;
  reorderFavorites: (orderedIds: string[]) => Promise<void>;
}

function useFavorites(): UseFavoritesReturn {
  const [favorites, setFavorites] = useState<ResolvedFavorite[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchFavorites = useCallback(async () => {
    try {
      const res = await fetch("/api/favorites");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setFavorites(data);
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const favoriteSet = useMemo(() => {
    const set = new Set<string>();
    for (const f of favorites) {
      set.add(`${f.entityType}:${f.entityId}`);
    }
    return set;
  }, [favorites]);

  const isFavorite = useCallback(
    (entityType: EntityType, entityId: string) => {
      return favoriteSet.has(`${entityType}:${entityId}`);
    },
    [favoriteSet]
  );

  const toggleFavorite = useCallback(
    async (entityType: EntityType, entityId: string) => {
      const key = `${entityType}:${entityId}`;
      const existing = favorites.find((f) => `${f.entityType}:${f.entityId}` === key);

      if (existing) {
        // Optimistic remove
        const prev = [...favorites];
        setFavorites((fav) => fav.filter((f) => f.id !== existing.id));
        try {
          const res = await fetch(`/api/favorites/${existing.id}`, { method: "DELETE" });
          if (!res.ok) setFavorites(prev); // rollback
        } catch {
          setFavorites(prev); // rollback
        }
      } else {
        // Add — POST then refetch for resolved data
        try {
          const res = await fetch("/api/favorites", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ entityType, entityId }),
          });
          if (res.ok) {
            await fetchFavorites();
          }
        } catch {
          // silently fail
        }
      }
    },
    [favorites, fetchFavorites]
  );

  const reorderFavorites = useCallback(
    async (orderedIds: string[]) => {
      // Optimistic reorder
      const prev = [...favorites];
      const reordered = orderedIds
        .map((id) => favorites.find((f) => f.id === id))
        .filter(Boolean) as ResolvedFavorite[];
      setFavorites(reordered);

      try {
        const res = await fetch("/api/favorites/reorder", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderedIds }),
        });
        if (!res.ok) setFavorites(prev); // rollback
      } catch {
        setFavorites(prev); // rollback
      }
    },
    [favorites]
  );

  return { favorites, isLoading, isFavorite, toggleFavorite, reorderFavorites };
}

// --- Context + Provider ---

const FavoritesContext = createContext<UseFavoritesReturn | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const value = useFavorites();
  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavoritesContext(): UseFavoritesReturn {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavoritesContext must be used within FavoritesProvider");
  return ctx;
}

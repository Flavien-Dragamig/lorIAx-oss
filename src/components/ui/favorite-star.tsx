"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EntityType } from "@/hooks/use-favorites";

interface FavoriteStarProps {
  entityType: EntityType;
  entityId: string;
  isFavorite: boolean;
  onToggle: () => void;
  size?: number;
  className?: string;
}

export function FavoriteStar({
  isFavorite,
  onToggle,
  size = 16,
  className,
}: FavoriteStarProps) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        "transition-opacity shrink-0",
        isFavorite
          ? "opacity-100 text-yellow-500"
          : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-yellow-500",
        className
      )}
      title={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
    >
      <Star
        className={cn(isFavorite && "fill-current")}
        size={size}
      />
    </button>
  );
}

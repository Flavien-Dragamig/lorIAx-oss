"use client";

import Link from "next/link";
import { Search, X } from "lucide-react";
import { useFavoritesContext } from "@/hooks/use-favorites";
import { FavoriteStar } from "@/components/ui/favorite-star";
import { SpaceIcon } from "./space-icon";
import type { SpaceItem } from "./types";

interface SpacesSectionProps {
  spaces: SpaceItem[];
  filteredSpaces: SpaceItem[];
  spaceGroups: { type: SpaceItem["type"]; label: string; spaces: SpaceItem[] }[];
  spaceSearch: string;
  activeSpace: string | null;
  onSpaceSearchChange: (value: string) => void;
  onActiveSpaceChange: (slug: string) => void;
}

export function SpacesSection({
  spaces,
  filteredSpaces,
  spaceGroups,
  spaceSearch,
  activeSpace,
  onSpaceSearchChange,
  onActiveSpaceChange,
}: SpacesSectionProps) {
  const { isFavorite, toggleFavorite } = useFavoritesContext();

  return (
    <div className="px-3 py-2">
      {/* Recherche */}
      {spaces.length > 3 && (
        <div className="relative mb-2">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={spaceSearch}
            onChange={(e) => onSpaceSearchChange(e.target.value)}
            placeholder="Filtrer les espaces..."
            className="w-full pl-7 pr-2 py-1 text-xs rounded-md bg-sidebar-accent/50 border border-transparent focus:border-primary/30 outline-none placeholder:text-muted-foreground/60 transition-colors"
          />
          {spaceSearch && (
            <button
              onClick={() => onSpaceSearchChange("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-sidebar-accent"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>
      )}

      {/* Liste groupée par type */}
      <div className="space-y-2">
        {spaceGroups.map(({ type, label, spaces: groupSpaces }) =>
          groupSpaces.length > 0 ? (
            <div key={type}>
              {/* Header de groupe (masqué si recherche active) */}
              {!spaceSearch && spaceGroups.filter((g) => g.spaces.length > 0).length > 1 && (
                <span className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider px-2 mb-0.5 block">
                  {label}
                </span>
              )}
              <ul className="space-y-0.5">
                {groupSpaces.map((space) => (
                  <li key={space.id}>
                    <Link
                      href={`/s/${space.slug}`}
                      onClick={() => onActiveSpaceChange(space.slug)}
                      className={`group w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                        activeSpace === space.slug
                          ? "bg-sidebar-accent font-medium"
                          : "hover:bg-sidebar-accent"
                      }`}
                    >
                      <SpaceIcon type={space.type} icon={space.icon} avatarUrl={space.type === "personal" ? space.ownerAvatarUrl : undefined} email={space.type === "personal" ? space.ownerEmail : undefined} />
                      <span className="truncate flex-1">{space.name}</span>
                      <FavoriteStar
                        entityType="space"
                        entityId={space.id}
                        isFavorite={isFavorite("space", space.id)}
                        onToggle={() => toggleFavorite("space", space.id)}
                        size={14}
                      />
                      {space.classification && space.classification !== "internal" && (
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            space.classification === "public" ? "bg-green-500" :
                            space.classification === "confidential" ? "bg-amber-500" :
                            space.classification === "secret" ? "bg-red-500" : ""
                          }`}
                          title={
                            space.classification === "public" ? "Public" :
                            space.classification === "confidential" ? "Confidentiel" :
                            space.classification === "secret" ? "Secret" : ""
                          }
                        />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null
        )}
        {filteredSpaces.length === 0 && spaceSearch && (
          <p className="text-xs text-muted-foreground px-2 py-2">
            Aucun espace trouvé.
          </p>
        )}
      </div>
    </div>
  );
}

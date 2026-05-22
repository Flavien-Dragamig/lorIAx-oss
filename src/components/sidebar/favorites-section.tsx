"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Star,
  FileText,
  Layers,
  LayoutTemplate,
  CalendarDays,
  Video,
  GripVertical,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFavoritesContext, type ResolvedFavorite } from "@/hooks/use-favorites";
import { CollapsibleSection } from "./collapsible-section";

// ─── Helper : icône par type d'entité ───────────────────────────────────────

function getEntityIcon(entityType: string): LucideIcon {
  switch (entityType) {
    case "document":
      return FileText;
    case "space":
      return Layers;
    case "template":
      return LayoutTemplate;
    case "calendar_event":
      return CalendarDays;
    case "meeting":
      return Video;
    default:
      return FileText;
  }
}

// ─── Élément favori triable ─────────────────────────────────────────────────

function SortableFavoriteItem({
  favorite,
  onRemove,
}: {
  favorite: ResolvedFavorite;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: favorite.id });

  const Icon = getEntityIcon(favorite.entityType);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li ref={setNodeRef} style={style} {...attributes}>
      <Link
        href={favorite.href}
        className={cn(
          "group flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors hover:bg-sidebar-accent",
          isDragging && "opacity-50"
        )}
      >
        <span
          {...listeners}
          className="cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </span>
        {favorite.icon ? (
          <span className="text-sm shrink-0">{favorite.icon}</span>
        ) : (
          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <span className="truncate flex-1">{favorite.title}</span>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-yellow-500 transition-opacity shrink-0"
          title="Retirer des favoris"
        >
          <Star className="h-3.5 w-3.5 fill-current text-yellow-500" size={14} />
        </button>
      </Link>
    </li>
  );
}

// ─── Section Favoris ────────────────────────────────────────────────────────

export function FavoritesSection() {
  const { favorites, reorderFavorites, toggleFavorite } =
    useFavoritesContext();

  const [activeDrag, setActiveDrag] = useState<ResolvedFavorite | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = event.active.id as string;
      const found = favorites.find((f) => f.id === id) ?? null;
      setActiveDrag(found);
    },
    [favorites]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDrag(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = favorites.findIndex((f) => f.id === active.id);
      const newIndex = favorites.findIndex((f) => f.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(favorites, oldIndex, newIndex);
      reorderFavorites(reordered.map((f) => f.id));
    },
    [favorites, reorderFavorites]
  );

  return (
    <CollapsibleSection
      id="favorites"
      title="Favoris"
      icon={Star}
      count={favorites.length}
    >
      {favorites.length === 0 ? (
        <div className="px-3 py-2">
          <p className="text-xs text-muted-foreground px-2 py-4">
            Cliquez ★ pour ajouter
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={favorites.map((f) => f.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="px-1 py-1 space-y-0.5">
              {favorites.map((fav) => (
                <SortableFavoriteItem
                  key={fav.id}
                  favorite={fav}
                  onRemove={() =>
                    toggleFavorite(fav.entityType, fav.entityId)
                  }
                />
              ))}
            </ul>
          </SortableContext>
          <DragOverlay>
            {activeDrag && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-popover border border-border shadow-lg text-sm">
                {activeDrag.icon ? (
                  <span className="text-sm shrink-0">
                    {activeDrag.icon}
                  </span>
                ) : (
                  (() => {
                    const OverlayIcon = getEntityIcon(activeDrag.entityType);
                    return (
                      <OverlayIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    );
                  })()
                )}
                <span className="truncate max-w-[150px]">
                  {activeDrag.title}
                </span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </CollapsibleSection>
  );
}

"use client";

import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/core";
import { useState, useRef, useCallback } from "react";
import {
  MapPin,
  Trash2,
  Maximize2,
  Minimize2,
  Search,
  X,
  Route,
  Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { MapConfig, MapMarker, GeoResult } from "./types";
import { DEFAULT_CONFIG, MARKER_COLORS } from "./constants";
import { formatDistance, formatDuration, profileIcon, searchPlaces } from "./utils";
import { LeafletMap } from "./leaflet-map";
import { RoutePanel } from "./route-panel";

export function MapBlockView({
  node,
  updateAttributes,
  selected,
  deleteNode,
  editor,
}: NodeViewProps) {
  const rawConfig = node.attrs.mapConfig;
  const config: MapConfig = typeof rawConfig === "string" ? (() => { try { return JSON.parse(rawConfig); } catch { return DEFAULT_CONFIG; } })() : rawConfig || DEFAULT_CONFIG;
  const [fullscreen, setFullscreen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showRoutePanel, setShowRoutePanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GeoResult[]>([]);
  const [editingMarkerId, setEditingMarkerId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isEditable = editor?.isEditable;

  const updateConfig = useCallback(
    (newConfig: MapConfig) => {
      updateAttributes({ mapConfig: newConfig });
    },
    [updateAttributes]
  );

  // Recherche avec debounce automatique
  function handleSearchInput(value: string) {
    setSearchQuery(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (value.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      setSearching(true);
      const results = await searchPlaces(value.trim());
      setSearchResults(results);
      if (results.length === 0 && value.trim().length >= 3) {
        toast.error("Aucun lieu trouvé", {
          description: "Essayez un nom plus précis ou une adresse complète.",
        });
      }
      setSearching(false);
    }, 350);
  }

  function selectSearchResult(result: GeoResult) {
    const newMarker: MapMarker = {
      id: crypto.randomUUID(),
      lat: result.lat,
      lng: result.lng,
      label: result.display_name.split(",")[0],
      color: MARKER_COLORS[config.markers.length % MARKER_COLORS.length],
    };
    updateConfig({
      ...config,
      center: [result.lat, result.lng],
      zoom: 14,
      markers: [...config.markers, newMarker],
    });
    setSearchQuery("");
    setSearchResults([]);
    setShowSearch(false);
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    const results = await searchPlaces(searchQuery.trim());
    setSearchResults(results);
    if (results.length === 0) {
      toast.error("Lieu introuvable", {
        description: `Aucun résultat pour « ${searchQuery.trim()} ». Essayez un nom plus précis.`,
      });
    }
    setSearching(false);
  }

  function removeMarker(id: string) {
    updateConfig({
      ...config,
      markers: config.markers.filter((m) => m.id !== id),
    });
  }

  function startEditLabel(marker: MapMarker) {
    setEditingMarkerId(marker.id);
    setEditingLabel(marker.label);
  }

  function saveLabel(id: string) {
    updateConfig({
      ...config,
      markers: config.markers.map((m) =>
        m.id === id ? { ...m, label: editingLabel.trim() || m.label } : m
      ),
    });
    setEditingMarkerId(null);
  }

  const toolbarVisible = selected || showSearch || showRoutePanel || fullscreen;
  const routes = config.routes || [];
  const currentRoute = routes[0];

  const containerClass = fullscreen
    ? "fixed inset-0 z-50 bg-background flex flex-col"
    : `map-block group/map ${selected ? "is-selected" : ""}`;

  return (
    <NodeViewWrapper className={containerClass}>
      {/* Toolbar overlay (hover + active states) */}
      {isEditable && (
        <div className={`map-block-toolbar ${toolbarVisible ? "is-visible" : ""}`}>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <MapPin className="h-4 w-4 text-blue-500 shrink-0" />
            <input
              type="text"
              value={node.attrs.title || ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateAttributes({ title: e.target.value })}
              onMouseDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
              onKeyDown={(e: React.KeyboardEvent) => e.stopPropagation()}
              placeholder="Carte"
              className="flex-1 max-w-[160px] px-1.5 py-0.5 text-xs font-medium rounded border-none bg-transparent focus:outline-none focus:ring-1 focus:ring-primary truncate"
            />
            <span className="text-xs text-muted-foreground shrink-0">
              {config.markers.length > 0 && `${config.markers.length} pt${config.markers.length > 1 ? "s" : ""}`}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {showSearch ? (
              <div className="relative flex items-center gap-1">
                <div className="relative">
                  <Input
                    ref={searchRef}
                    value={searchQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleSearchInput(e.target.value)
                    }
                    placeholder="Rechercher un lieu, une adresse..."
                    className="h-7 text-xs w-64"
                    onKeyDown={(e: React.KeyboardEvent) => {
                      if (e.key === "Enter") handleSearch();
                      if (e.key === "Escape") {
                        setShowSearch(false);
                        setSearchResults([]);
                      }
                    }}
                  />
                  {/* Dropdown de résultats */}
                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                      {searchResults.map((result, i) => (
                        <button
                          key={`${result.lat}-${result.lng}-${i}`}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors border-b border-border last:border-b-0 flex items-start gap-2"
                          onClick={() => selectSearchResult(result)}
                        >
                          <MapPin className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{result.display_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {searching && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleSearch}
                  disabled={searching}
                  title="Rechercher"
                >
                  <Search className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => { setShowSearch(false); setSearchResults([]); }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  setShowSearch(true);
                  setTimeout(() => searchRef.current?.focus(), 50);
                }}
                title="Rechercher un lieu"
              >
                <Search className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowRoutePanel(!showRoutePanel)}
              title="Itinéraire"
              className={showRoutePanel ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground" : ""}
            >
              <Route className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setFullscreen(!fullscreen)}
              title={fullscreen ? "Quitter le plein écran" : "Plein écran"}
            >
              {fullscreen ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={deleteNode}
              title="Supprimer le bloc"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Route panel */}
      {isEditable && showRoutePanel && (
        <RoutePanel config={config} updateConfig={updateConfig} />
      )}

      {/* Map */}
      <div className={fullscreen ? "flex-1 min-h-0" : ""}>
        <LeafletMap
          config={config}
          onConfigChange={updateConfig}
          isEditable={!!isEditable}
          fullscreen={fullscreen}
        />
      </div>

      {/* Markers list (edit mode) */}
      {isEditable && config.markers.length > 0 && (
        <div className="px-3 py-2 bg-muted/30 border-t border-border rounded-b space-y-1">
          <p className="text-xs font-medium text-muted-foreground mb-1">
            Marqueurs — cliquez sur la carte pour en ajouter
          </p>
          {config.markers.map((marker, i) => (
            <div
              key={marker.id}
              className="flex items-center gap-2 text-xs group"
            >
              <div
                className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-white text-[9px] font-bold"
                style={{ backgroundColor: marker.color || "#2563eb" }}
              >
                {i + 1}
              </div>
              {editingMarkerId === marker.id ? (
                <Input
                  value={editingLabel}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setEditingLabel(e.target.value)
                  }
                  className="h-6 text-xs flex-1"
                  onMouseDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === "Enter") saveLabel(marker.id);
                    if (e.key === "Escape") setEditingMarkerId(null);
                    e.stopPropagation();
                  }}
                  onBlur={() => saveLabel(marker.id)}
                  autoFocus
                />
              ) : (
                <span
                  className="flex-1 cursor-pointer hover:underline truncate"
                  onClick={() => startEditLabel(marker)}
                  title="Cliquer pour renommer"
                >
                  {marker.label}
                </span>
              )}
              <span className="text-muted-foreground tabular-nums">
                {marker.lat.toFixed(4)}, {marker.lng.toFixed(4)}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => removeMarker(marker.id)}
                className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10"
                title="Supprimer"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Read-only footer: marker count + route info */}
      {!isEditable && (config.markers.length > 0 || (currentRoute?.geometry && currentRoute.distance != null)) && (
        <div className="px-3 py-1.5 bg-muted/30 border-t border-border rounded-b flex items-center gap-3">
          {config.markers.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {config.markers.length} marqueur{config.markers.length > 1 ? "s" : ""}
            </div>
          )}
          {currentRoute?.geometry && currentRoute.distance != null && currentRoute.duration != null && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="text-border">|</span>
              {profileIcon(currentRoute.profile)}
              <span>{formatDistance(currentRoute.distance)}</span>
              <span>·</span>
              <span>{formatDuration(currentRoute.duration)}</span>
            </div>
          )}
        </div>
      )}
    </NodeViewWrapper>
  );
}

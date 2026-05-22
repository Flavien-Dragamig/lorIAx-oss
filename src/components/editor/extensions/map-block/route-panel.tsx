"use client";

import { useState } from "react";
import {
  Route,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MapConfig, MapRoute, RouteStyle } from "./types";
import { ROUTE_COLORS, WEIGHT_OPTIONS } from "./constants";
import { formatDistance, formatDuration, profileIcon, profileLabel } from "./utils";

export function RoutePanel({
  config,
  updateConfig,
}: {
  config: MapConfig;
  updateConfig: (config: MapConfig) => void;
}) {
  const routes = config.routes || [];
  const currentRoute = routes[0]; // V1: single route

  const [profile, setProfile] = useState<"driving" | "cycling" | "foot">(
    currentRoute?.profile || "driving"
  );
  const [routeColor, setRouteColor] = useState(currentRoute?.style.color || "#2563eb");
  const [routeWeight, setRouteWeight] = useState(currentRoute?.style.weight || 5);
  const [routeDash, setRouteDash] = useState(!!currentRoute?.style.dashArray);
  const [routeArrows, setRouteArrows] = useState(currentRoute?.style.arrows ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasEnoughMarkers = config.markers.length >= 2;

  async function calculateRoute() {
    if (!hasEnoughMarkers) return;
    setLoading(true);
    setError(null);

    try {
      // Coordinates as [lng, lat] for OSRM
      const coordinates = config.markers.map((m) => [m.lng, m.lat]);

      const res = await fetch("/api/route-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coordinates, profile }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erreur de calcul");
        setLoading(false);
        return;
      }

      const newRoute: MapRoute = {
        id: currentRoute?.id || crypto.randomUUID(),
        markerIds: config.markers.map((m) => m.id),
        profile,
        style: {
          color: routeColor,
          weight: routeWeight,
          dashArray: routeDash ? "10,6" : undefined,
          arrows: routeArrows,
        },
        geometry: data.geometry,
        distance: data.distance,
        duration: data.duration,
      };

      updateConfig({
        ...config,
        routes: [newRoute],
      });
    } catch {
      setError("Impossible de contacter le service de routage");
    }
    setLoading(false);
  }

  function removeRoute() {
    updateConfig({ ...config, routes: [] });
  }

  // Update style in real-time if route already exists
  function updateRouteStyle(updates: Partial<RouteStyle>) {
    if (!currentRoute?.geometry) return;
    const updated = {
      ...currentRoute,
      style: { ...currentRoute.style, ...updates },
    };
    updateConfig({ ...config, routes: [updated] });
  }

  return (
    <div className="px-3 py-2 bg-muted/30 border-b border-border space-y-2">
      {/* Profile selector */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground mr-1">Profil :</span>
        {(["driving", "cycling", "foot"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setProfile(p)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
              profile === p
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-accent text-muted-foreground"
            }`}
            title={profileLabel(p)}
          >
            {profileIcon(p)}
            <span className="hidden sm:inline">{profileLabel(p)}</span>
          </button>
        ))}
      </div>

      {/* Style options */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Couleur :</span>
        <div className="flex items-center gap-1">
          {ROUTE_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => {
                setRouteColor(c);
                updateRouteStyle({ color: c });
              }}
              className={`w-5 h-5 rounded-full border-2 transition-transform ${
                routeColor === c ? "border-foreground scale-110" : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <span className="text-xs text-muted-foreground ml-2">Trait :</span>
        {WEIGHT_OPTIONS.map((w) => (
          <button
            key={w.value}
            onClick={() => {
              setRouteWeight(w.value);
              updateRouteStyle({ weight: w.value });
            }}
            className={`px-1.5 py-0.5 rounded text-xs ${
              routeWeight === w.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-accent text-muted-foreground"
            }`}
          >
            {w.label}
          </button>
        ))}

        <button
          onClick={() => {
            const next = !routeDash;
            setRouteDash(next);
            updateRouteStyle({ dashArray: next ? "10,6" : undefined });
          }}
          className={`px-1.5 py-0.5 rounded text-xs ${
            routeDash
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-accent text-muted-foreground"
          }`}
          title="Pointillés"
        >
          - - -
        </button>

        <button
          onClick={() => {
            const next = !routeArrows;
            setRouteArrows(next);
            updateRouteStyle({ arrows: next });
          }}
          className={`px-1.5 py-0.5 rounded text-xs ${
            routeArrows
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-accent text-muted-foreground"
          }`}
          title="Flèches directionnelles"
        >
          ▸▸
        </button>
      </div>

      {/* Action */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={calculateRoute}
          disabled={loading || !hasEnoughMarkers}
        >
          {loading ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
              Calcul...
            </>
          ) : (
            <>
              <Route className="h-3 w-3 mr-1" />
              Calculer l&apos;itinéraire
            </>
          )}
        </Button>

        {!hasEnoughMarkers && (
          <span className="text-xs text-muted-foreground">
            Ajoutez au moins 2 marqueurs
          </span>
        )}

        {currentRoute?.geometry && (
          <button
            onClick={removeRoute}
            className="text-xs text-destructive hover:underline ml-auto"
          >
            Supprimer l&apos;itinéraire
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {/* Route info */}
      {currentRoute?.geometry && currentRoute.distance != null && currentRoute.duration != null && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {profileIcon(currentRoute.profile)}
          <span>{formatDistance(currentRoute.distance)}</span>
          <span>·</span>
          <span>{formatDuration(currentRoute.duration)}</span>
        </div>
      )}
    </div>
  );
}

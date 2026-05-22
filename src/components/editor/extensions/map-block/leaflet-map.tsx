"use client";

import { useState, useEffect, useRef } from "react";
import type { MapConfig, MapMarker } from "./types";
import { MARKER_COLORS } from "./constants";

export function LeafletMap({
  config,
  onConfigChange,
  isEditable,
  fullscreen = false,
}: {
  config: MapConfig;
  onConfigChange: (config: MapConfig) => void;
  isEditable: boolean;
  fullscreen?: boolean;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersLayerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routesLayerRef = useRef<any>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [L, setL] = useState<any>(null);
  const configRef = useRef(config);

  // Keep configRef in sync
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Load Leaflet + CSS dynamiquement (chargés uniquement quand un bloc carte est affiché)
  useEffect(() => {
    let cancelled = false;

    async function loadLeaflet() {
      await import("leaflet/dist/leaflet.css");
      const leaflet = await import("leaflet");

      if (!cancelled) {
        setL(leaflet.default || leaflet);
        setLeafletLoaded(true);
      }
    }

    loadLeaflet();
    return () => { cancelled = true; };
  }, []);

  // Initialize map
  useEffect(() => {
    if (!leafletLoaded || !L || !mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: config.center,
      zoom: config.zoom,
      scrollWheelZoom: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    routesLayerRef.current = L.layerGroup().addTo(map);

    // Save position changes
    map.on("moveend", () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      onConfigChange({
        ...configRef.current,
        center: [center.lat, center.lng],
        zoom,
      });
    });

    // Click to add marker
    if (isEditable) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.on("click", (e: any) => {
        const newMarker: MapMarker = {
          id: crypto.randomUUID(),
          lat: e.latlng.lat,
          lng: e.latlng.lng,
          label: `Point ${configRef.current.markers.length + 1}`,
          color: MARKER_COLORS[configRef.current.markers.length % MARKER_COLORS.length],
        };
        onConfigChange({
          ...configRef.current,
          markers: [...configRef.current.markers, newMarker],
        });
      });
    }

    mapRef.current = map;

    // Fix Leaflet tiles rendering in dynamic containers
    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // deps volontairement restreintes : onConfigChange et isEditable sont accédés
    // via configRef/closure pour éviter de recréer la carte à chaque changement de config
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leafletLoaded, L]);

  // Recalculer les tuiles quand le mode plein écran change
  useEffect(() => {
    if (!mapRef.current) return;
    // Laisser le DOM se mettre à jour avant d'invalider
    const timer = setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 50);
    return () => clearTimeout(timer);
  }, [fullscreen, config.height]);

  // Update markers
  useEffect(() => {
    if (!L || !markersLayerRef.current) return;
    markersLayerRef.current.clearLayers();

    config.markers.forEach((m) => {
      const icon = L.divIcon({
        html: `<div style="background:${m.color || "#2563eb"};width:24px;height:24px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:bold;">${config.markers.indexOf(m) + 1}</div>`,
        className: "custom-marker-icon",
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([m.lat, m.lng], { icon, draggable: isEditable });
      marker.bindPopup(`<b>${m.label}</b><br/>Lat: ${m.lat.toFixed(5)}<br/>Lng: ${m.lng.toFixed(5)}`);

      if (isEditable) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        marker.on("dragend", (e: any) => {
          const pos = e.target.getLatLng();
          onConfigChange({
            ...configRef.current,
            markers: configRef.current.markers.map((mk) =>
              mk.id === m.id ? { ...mk, lat: pos.lat, lng: pos.lng } : mk
            ),
          });
        });
      }

      markersLayerRef.current.addLayer(marker);
    });
  }, [config.markers, L, isEditable, onConfigChange]);

  // Update routes (polylines + arrows)
  useEffect(() => {
    if (!L || !routesLayerRef.current) return;
    routesLayerRef.current.clearLayers();

    const routes = config.routes || [];
    for (const route of routes) {
      if (!route.geometry || route.geometry.length < 2) continue;

      // Draw polyline
      const polyline = L.polyline(route.geometry, {
        color: route.style.color,
        weight: route.style.weight,
        dashArray: route.style.dashArray || undefined,
        opacity: 0.8,
        lineJoin: "round",
        lineCap: "round",
      });
      routesLayerRef.current.addLayer(polyline);

      // Draw arrow decorations
      if (route.style.arrows && route.geometry.length > 2) {
        const geom = route.geometry;
        const step = Math.max(1, Math.floor(geom.length / 20)); // ~20 arrows max
        for (let i = step; i < geom.length - 1; i += step) {
          const p1 = geom[i - 1];
          const p2 = geom[i];
          const angle = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) * (180 / Math.PI);
          const arrowIcon = L.divIcon({
            html: `<svg width="14" height="14" viewBox="0 0 14 14" style="transform:rotate(${angle - 90}deg)"><path d="M7 2L12 10H2Z" fill="${route.style.color}" opacity="0.9"/></svg>`,
            className: "route-arrow-icon",
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          });
          routesLayerRef.current.addLayer(L.marker(p2, { icon: arrowIcon, interactive: false }));
        }
      }
    }
  }, [config.routes, L]);

  if (!leafletLoaded) {
    return (
      <div
        className="flex items-center justify-center bg-muted/50 rounded"
        style={{ height: config.height }}
      >
        <div className="text-sm text-muted-foreground animate-pulse">
          Chargement de la carte...
        </div>
      </div>
    );
  }

  return (
    <div
      ref={mapContainerRef}
      style={fullscreen ? { height: "100%", width: "100%" } : { height: config.height, width: "100%" }}
      className="rounded z-0"
    />
  );
}

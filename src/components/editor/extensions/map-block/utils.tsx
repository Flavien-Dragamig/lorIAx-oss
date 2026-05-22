"use client";

import { Car, Bike, Footprints } from "lucide-react";
import type { GeoResult } from "./types";

export function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
}

export function profileIcon(profile: string) {
  switch (profile) {
    case "driving": return <Car className="h-3.5 w-3.5" />;
    case "cycling": return <Bike className="h-3.5 w-3.5" />;
    case "foot": return <Footprints className="h-3.5 w-3.5" />;
    default: return <Car className="h-3.5 w-3.5" />;
  }
}

export function profileLabel(profile: string) {
  switch (profile) {
    case "driving": return "Voiture";
    case "cycling": return "Vélo";
    case "foot": return "À pied";
    default: return "Voiture";
  }
}

export async function searchPlaces(query: string): Promise<GeoResult[]> {
  // Photon (Komoot) — rapide, autocomplete, basé sur OSM
  try {
    const res = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6&lang=fr`,
      { headers: { "User-Agent": "LorIAx/1.0" }, signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.features?.length > 0) {
        return data.features.map((f: { geometry: { coordinates: [number, number] }; properties: Record<string, string> }) => ({
          lat: f.geometry.coordinates[1],
          lng: f.geometry.coordinates[0],
          display_name: formatPhotonResult(f.properties),
          type: f.properties.osm_value || f.properties.type,
        }));
      }
    }
  } catch {
    // Photon indisponible — fallback Nominatim
  }

  // Fallback Nominatim
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&accept-language=fr`,
      { headers: { "User-Agent": "LorIAx/1.0" }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data)) {
      return data.map((d: { lat: string; lon: string; display_name: string; type: string }) => ({
        lat: parseFloat(d.lat),
        lng: parseFloat(d.lon),
        display_name: d.display_name,
        type: d.type,
      }));
    }
  } catch (err) {
    console.warn("[MapBlock] Geocoding failed:", err);
  }
  return [];
}

export function formatPhotonResult(props: Record<string, string | undefined>): string {
  const parts: string[] = [];
  if (props.name) parts.push(props.name);
  if (props.street) {
    const street = props.housenumber ? `${props.housenumber} ${props.street}` : props.street;
    if (street !== props.name) parts.push(street);
  }
  if (props.city && props.city !== props.name) parts.push(props.city);
  if (props.state && props.state !== props.city) parts.push(props.state);
  if (props.country) parts.push(props.country);
  return parts.join(", ") || "Lieu inconnu";
}

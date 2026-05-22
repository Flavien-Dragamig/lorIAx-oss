import type { MapConfig } from "./types";

export const DEFAULT_CONFIG: MapConfig = {
  center: [46.603354, 1.888334], // Centre de la France
  zoom: 6,
  markers: [],
  height: 400,
};

export const MARKER_COLORS = [
  "#2563eb", // blue
  "#dc2626", // red
  "#16a34a", // green
  "#ea580c", // orange
  "#9333ea", // purple
  "#0891b2", // cyan
];

export const ROUTE_COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#ea580c", "#9333ea", "#0891b2",
];

export const WEIGHT_OPTIONS = [
  { label: "Fin", value: 3 },
  { label: "Normal", value: 5 },
  { label: "Épais", value: 8 },
];

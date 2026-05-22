export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  color?: string;
}

export interface RouteStyle {
  color: string;
  weight: number;
  dashArray?: string;
  arrows?: boolean;
}

export interface MapRoute {
  id: string;
  markerIds: string[];
  profile: "driving" | "cycling" | "foot";
  style: RouteStyle;
  geometry?: [number, number][];
  distance?: number;
  duration?: number;
}

export interface MapConfig {
  center: [number, number];
  zoom: number;
  markers: MapMarker[];
  height: number;
  routes?: MapRoute[];
}

export interface GeoResult {
  lat: number;
  lng: number;
  display_name: string;
  type?: string;
}

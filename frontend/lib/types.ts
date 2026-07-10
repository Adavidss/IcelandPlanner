// TypeScript mirrors of every data contract the pipeline produces
// (scripts/build-*.mjs and scripts/live-*.mjs) plus the localStorage trip model.

export type Region =
  | "capital" | "reykjanes" | "south" | "southeast" | "east"
  | "northeast" | "north" | "westfjords" | "west" | "highlands";

export const REGION_NAMES: Record<Region, string> = {
  capital: "Capital area",
  reykjanes: "Reykjanes",
  south: "South",
  southeast: "Southeast",
  east: "East Fjords",
  northeast: "Northeast",
  north: "North",
  westfjords: "Westfjords",
  west: "West",
  highlands: "Highlands",
};

export type Category =
  | "waterfall" | "glacier" | "glacier_lagoon" | "hot_spring" | "geothermal"
  | "beach" | "canyon" | "crater" | "lava_field" | "cave" | "museum"
  | "church" | "viewpoint" | "town" | "wildlife" | "pool" | "other";

// ---- attractions.json / attractions-extra.json ---------------------------

export interface Attraction {
  id: string;
  name: string;
  nameIs?: string;
  lat: number;
  lng: number;
  category: Category;
  region: Region;
  description: string;
  durationMin?: number;
  /** Jan-first, 0 closed · 1 possible · 2 good · 3 peak. Absent on extended tier. */
  months?: number[];
  bestMonths?: number[];
  seasonNote?: string | null;
  access?: "paved" | "gravel" | "f_road" | "hike";
  fee?: boolean;
  feeNote?: string | null;
  links?: { official?: string | null; wikipedia?: string | null };
  photo?: { src: string; credit: string; license: string } | null;
  tags?: string[];
  /** "extended" = auto-harvested from Wikidata (lower prominence). */
  tier?: "extended";
  extract?: string | null;
  thumbnail?: string | null;
}

export interface AttractionsFile {
  version?: number;
  count?: number;
  attractions: Attraction[];
}

// ---- tours.json -----------------------------------------------------------

export interface Tour {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string[];
  type: string | null;
  durationMin: number | null;
  priceFromISK: number | null;
  popularIndex: number | null;
  groupSize: string | null;
  heroImage: string | null;
  bookingUrl: string;
  months: number[];
  seasonNote?: string | null;
  difficulty?: string | null;
  minimumAge?: number | null;
  departsFrom?: string | null;
  duration?: string | null;
  included?: string[];
  highlights?: string[];
  needToKnow?: string[];
  images?: string[];
}

export interface ToursFile {
  generated_at: string;
  source: string;
  count: number;
  tours: Tour[];
}

// ---- poi-*.json -----------------------------------------------------------

export type PoiKind = "food" | "fuel" | "pool" | "grocery" | "stay";

export interface Poi {
  id: string;
  name: string;
  kind: PoiKind;
  subkind: string;
  lat: number;
  lng: number;
  cuisine: string | null;
  hours: string | null;
  website: string | null;
  phone: string | null;
  brand: string | null;
  town: string | null;
}

export interface PoiFile {
  generated_at: string;
  source: string;
  count: number;
  poi: Poi[];
}

// ---- routes.json + geojson --------------------------------------------------

export interface RouteInfo {
  id: string;
  name: string;
  color: string;
  distanceKm: number;
  driveMin: number;
  daysRecommended: number;
  loop: boolean;
  start: string;
  months: number[];
  seasonNote?: string | null;
  description: string;
  stops: string[];
  dayBreaks?: number[];
  geometry: string;
}

export interface RoutesFile {
  version?: number;
  count?: number;
  routes: RouteInfo[];
}

export interface RouteGeometry {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    properties: { id: string };
    geometry: { type: "LineString"; coordinates: [number, number][] }; // [lng, lat]
  }[];
}

// ---- road-geometry.json (tier-1 static) + roads.json (tier-2 live) --------

export interface RoadGeometrySegment {
  id: number;
  road: string | null;
  name: string;
  /** MultiLineString-ish: parts of [lat, lng] points. */
  parts: [number, number][][];
}

export interface RoadGeometryFile {
  generated_at: string;
  count: number;
  segments: RoadGeometrySegment[];
}

export type RoadCondition =
  | "good" | "wet" | "spots" | "slippery" | "very_slippery" | "snow" | "slush"
  | "difficult" | "extremely_difficult" | "impassable" | "closed" | "mountain"
  | "no_service" | "unknown";

export interface RoadLegendEntry {
  label: string;
  labelIs: string;
  color: string;
}

export interface RoadSegmentCondition {
  id: number;
  name: string;
  condition: RoadCondition;
  label: string;
  recordedAt: string | null;
}

export interface RoadsFile {
  updated_at: string;
  source: string;
  legend: Record<string, RoadLegendEntry>;
  counts: Partial<Record<RoadCondition, number>>;
  segments: RoadSegmentCondition[];
}

// ---- weather.json (tier-2) -------------------------------------------------

export interface ForecastHour {
  time: string; // "2026-07-10 12:00:00" Iceland local == UTC (zone-less)
  windMs: number | null;
  windDir: string | null;
  tempC: number | null;
  desc: string | null;
  precipMm: number | null;
  cloudPct: number | null;
}

export interface StationForecast {
  id: number;
  name: string;
  region: Region;
  lat: number;
  lng: number;
  atime: string | null;
  forecast: ForecastHour[];
}

export interface WeatherFile {
  updated_at: string;
  source: string;
  stations: StationForecast[];
}

// ---- hazards.json (tier-2) ---------------------------------------------------

export interface HazardPoint {
  lat: number;
  lng: number;
  type: string;
  title: string | null;
  description: string | null;
}

export interface HazardsFile {
  updated_at: string;
  points: HazardPoint[];
  reynisfjara: { level: "GREEN" | "YELLOW" | "RED" | "UNKNOWN"; color: string; raw: string | null; at?: string | null };
}

// ---- status.json (tier-2 heartbeat) -----------------------------------------

export interface LiveStatus {
  run_at: string;
  run_id: number | null;
  datasets: Record<string, { ok: boolean; changed: boolean; updated_at: string | null; error: string | null }>;
}

// ---- meta.json ---------------------------------------------------------------

export interface Meta {
  generated_at: string;
  datasets: Record<string, { status: "fresh" | "cache" | "empty"; generated_at?: string; count?: number; source?: string }>;
  map: { center: [number, number]; zoom: number; bounds: [[number, number], [number, number]] };
  links: Record<string, string>;
}

// ---- localStorage trip model (ip.trips.v1) -----------------------------------

export type StopKind = "attraction" | "tour" | "poi" | "route" | "custom";

export interface TripStop {
  id: string;
  kind: StopKind;
  refId: string | null;
  name: string; // denormalized — trips survive data-file churn
  lat: number | null;
  lng: number | null;
  durationMin?: number;
  note?: string;
}

export interface TripDay {
  id: string;
  note: string;
  stops: TripStop[];
}

export interface Trip {
  id: string;
  name: string;
  startDate: string | null; // "2026-09-12" zone-less; parse by numbers only
  days: TripDay[];
  created: string;
  updated: string;
}

/** Seed passed from cards/popups into addStop. */
export interface TripStopSeed {
  kind: StopKind;
  refId: string | null;
  name: string;
  lat: number | null;
  lng: number | null;
  durationMin?: number;
}

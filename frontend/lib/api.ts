// Static data client — no live backend. The app reads pre-built JSON from
// <basePath>/data/*.json (produced by scripts/build-all.mjs in CI) and does
// all filtering client-side. Every loader falls back to a typed empty default
// so a data-less checkout renders friendly empty states, never crashes.

import type {
  AttractionsFile,
  DayBlocksFile,
  Meta,
  PoiFile,
  PoiKind,
  RoadGeometryFile,
  RouteGeometry,
  RoutesFile,
  ToursFile,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const _cache = new Map<string, Promise<unknown>>();

function loadJSON<T>(name: string, fallback: T): Promise<T> {
  let p = _cache.get(name);
  if (!p) {
    // "no-cache" revalidates (cheap 304s) so daily-rebuilt data never goes
    // stale for returning visitors; the in-memory cache dedupes per session.
    p = fetch(`${BASE}/data/${name}`, { cache: "no-cache" })
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load ${name}: ${r.status}`);
        return r.json() as Promise<T>;
      })
      .catch(() => fallback);
    _cache.set(name, p);
  }
  return p as Promise<T>;
}

export function getTours(): Promise<ToursFile> {
  return loadJSON<ToursFile>("tours.json", { generated_at: "", source: "re.is", count: 0, tours: [] });
}

export function getAttractions(): Promise<AttractionsFile> {
  return loadJSON<AttractionsFile>("attractions.json", { attractions: [] });
}

export function getAttractionsExtra(): Promise<AttractionsFile> {
  return loadJSON<AttractionsFile>("attractions-extra.json", { attractions: [] });
}

const POI_FILE: Record<PoiKind, string> = {
  food: "poi-food.json",
  fuel: "poi-fuel.json",
  pool: "poi-pools.json",
  grocery: "poi-shops.json",
  stay: "poi-stay.json",
};

export function getPoi(kind: PoiKind): Promise<PoiFile> {
  return loadJSON<PoiFile>(POI_FILE[kind], { generated_at: "", source: "overpass", count: 0, poi: [] });
}

export function getDayBlocks(): Promise<DayBlocksFile> {
  return loadJSON<DayBlocksFile>("day-blocks.json", { blocks: [] });
}

export function getRoutes(): Promise<RoutesFile> {
  return loadJSON<RoutesFile>("routes.json", { routes: [] });
}

export function getRouteGeometry(id: string): Promise<RouteGeometry> {
  return loadJSON<RouteGeometry>(`routes/${id}.geojson`, { type: "FeatureCollection", features: [] });
}

export function getRoadGeometry(): Promise<RoadGeometryFile> {
  return loadJSON<RoadGeometryFile>("road-geometry.json", { generated_at: "", count: 0, segments: [] });
}

export function getMeta(): Promise<Meta | null> {
  return loadJSON<Meta | null>("meta.json", null);
}

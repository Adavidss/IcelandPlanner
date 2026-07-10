"use client";

// The map page: layer chips (persisted, URL intents), the IcelandMap, search,
// and synchronized list panels per active layer.

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { AddToTripButton } from "@/components/AddToTripButton";
import { IcelandMap } from "@/components/IcelandMap";
import { SeasonBadge } from "@/components/SeasonBadge";
import { SearchIcon } from "@/components/icons";
import { FilterChips } from "@/components/ui";
import {
  getAttractions, getAttractionsExtra, getPoi, getRoadGeometry, getRouteGeometry, getRoutes,
} from "@/lib/api";
import { CATEGORY_META, POI_KIND_META } from "@/lib/categories";
import { distanceLabel, haversineKm } from "@/lib/geo";
import { getHazards, getRoads } from "@/lib/live";
import { scoreAt } from "@/lib/season";
import { useSeason } from "@/lib/season-context";
import { storeGet, storeSet } from "@/lib/store";
import { useTrip } from "@/lib/trip";
import { REGION_NAMES } from "@/lib/types";
import type {
  Attraction, HazardsFile, Poi, PoiKind, RoadGeometryFile, RoadsFile, RouteGeometry, RouteInfo,
} from "@/lib/types";

type LayerKey = "attractions" | "more" | "routes" | "food" | "fuel" | "pool" | "grocery" | "stay" | "conditions" | "hazards";

const LAYER_META: { key: LayerKey; label: string; default: boolean }[] = [
  { key: "attractions", label: "Attractions", default: true },
  { key: "routes", label: "Routes", default: true },
  { key: "more", label: "More places (auto)", default: false },
  { key: "food", label: "Food & drink", default: false },
  { key: "fuel", label: "Fuel", default: false },
  { key: "pool", label: "Pools", default: false },
  { key: "grocery", label: "Groceries", default: false },
  { key: "stay", label: "Stay", default: false },
  { key: "conditions", label: "Road conditions", default: false },
  { key: "hazards", label: "Hazards", default: false },
];

const DEFAULT_LAYERS = Object.fromEntries(LAYER_META.map((l) => [l.key, l.default])) as Record<LayerKey, boolean>;

function matches(q: string, hay: string): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const h = hay.toLowerCase();
  return words.every((w) => h.includes(w));
}

function Panel({ title, count, children, open = false }: { title: string; count: number; children: React.ReactNode; open?: boolean }) {
  return (
    <details className="rounded-xl border border-border bg-surface" open={open}>
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-strong">
        {title} <span className="ml-1 font-normal text-muted">({count})</span>
      </summary>
      <div className="border-t border-border/60 p-2">{children}</div>
    </details>
  );
}

function MapPageInner() {
  const params = useSearchParams();
  const { month } = useSeason();
  const { addStop } = useTrip();

  const [layers, setLayers] = useState<Record<LayerKey, boolean>>(DEFAULT_LAYERS);
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [extended, setExtended] = useState<Attraction[]>([]);
  const [pois, setPois] = useState<Partial<Record<PoiKind, Poi[]>>>({});
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [geometries, setGeometries] = useState<Record<string, RouteGeometry>>({});
  const [roads, setRoads] = useState<RoadsFile | null>(null);
  const [roadGeometry, setRoadGeometry] = useState<RoadGeometryFile | null>(null);
  const [hazards, setHazards] = useState<HazardsFile | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [poiHidden, setPoiHidden] = useState(false);
  const intentApplied = useRef(false);

  // Restore persisted layers, apply URL intents once.
  useEffect(() => {
    const saved = storeGet<Partial<Record<LayerKey, boolean>>>("layers.v1", {});
    setLayers((prev) => ({ ...prev, ...saved }));
  }, []);
  useEffect(() => {
    if (intentApplied.current) return;
    intentApplied.current = true;
    const layer = params.get("layer") as LayerKey | null;
    if (layer && LAYER_META.some((l) => l.key === layer)) {
      setLayers((prev) => ({ ...prev, [layer]: true }));
    }
    const place = params.get("place");
    if (place) setFocusId(place);
  }, [params]);

  const toggleLayer = (key: LayerKey) => {
    setLayers((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      storeSet("layers.v1", next);
      return next;
    });
  };

  // Data loads — POI kinds lazy-load when their layer first turns on.
  useEffect(() => {
    getAttractions().then((f) => setAttractions(f.attractions));
    getRoutes().then((f) => setRoutes(f.routes));
  }, []);
  useEffect(() => {
    if (layers.more && extended.length === 0) getAttractionsExtra().then((f) => setExtended(f.attractions));
  }, [layers.more, extended.length]);
  useEffect(() => {
    for (const kind of ["food", "fuel", "pool", "grocery", "stay"] as PoiKind[]) {
      if (layers[kind] && !pois[kind]) {
        getPoi(kind).then((f) => setPois((prev) => ({ ...prev, [kind]: f.poi })));
      }
    }
  }, [layers, pois]);
  useEffect(() => {
    if (layers.routes && routes.length > 0) {
      for (const r of routes) {
        if (!geometries[r.id]) {
          getRouteGeometry(r.id).then((g) => setGeometries((prev) => ({ ...prev, [r.id]: g })));
        }
      }
    }
  }, [layers.routes, routes, geometries]);
  useEffect(() => {
    if (layers.conditions && !roads) {
      getRoads().then(setRoads);
      getRoadGeometry().then((g) => setRoadGeometry(g.segments.length > 0 ? g : null));
    }
    if (layers.hazards && !hazards) getHazards().then(setHazards);
  }, [layers.conditions, layers.hazards, roads, hazards]);

  // Debounced search.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const visibleAttractions = useMemo(() => {
    if (!layers.attractions) return null;
    let list = attractions;
    if (category) list = list.filter((a) => a.category === category);
    return list;
  }, [layers.attractions, attractions, category]);

  const activePois = useMemo(() => {
    const out: Poi[] = [];
    for (const kind of ["food", "fuel", "pool", "grocery", "stay"] as PoiKind[]) {
      if (layers[kind] && pois[kind]) out.push(...(pois[kind] as Poi[]));
    }
    return out.length > 0 ? out : null;
  }, [layers, pois]);

  const routeLayerData = useMemo(() => {
    if (!layers.routes) return null;
    return routes
      .filter((r) => geometries[r.id]?.features.length)
      .map((r) => ({ info: r, geometry: geometries[r.id] }));
  }, [layers.routes, routes, geometries]);

  const conditionsData = useMemo(() => {
    if (!layers.conditions || !roads || !roadGeometry) return null;
    return { geometry: roadGeometry, roads };
  }, [layers.conditions, roads, roadGeometry]);

  // Search across attractions + loaded POIs.
  const searchResults = useMemo(() => {
    if (!debouncedQuery.trim()) return [];
    const out: { id: string; name: string; sub: string; layer: LayerKey }[] = [];
    for (const a of attractions) {
      if (matches(debouncedQuery, `${a.name} ${a.nameIs ?? ""} ${a.category} ${a.region}`)) {
        out.push({ id: a.id, name: a.name, sub: CATEGORY_META[a.category]?.label ?? a.category, layer: "attractions" });
      }
    }
    for (const kind of Object.keys(pois) as PoiKind[]) {
      for (const p of pois[kind] ?? []) {
        if (matches(debouncedQuery, `${p.name} ${p.subkind} ${p.town ?? ""} ${p.cuisine ?? ""}`)) {
          out.push({ id: p.id, name: p.name, sub: `${POI_KIND_META[p.kind]?.label}${p.town ? ` · ${p.town}` : ""}`, layer: p.kind as LayerKey });
        }
      }
    }
    return out.slice(0, 20);
  }, [debouncedQuery, attractions, pois]);

  const attractionRows = useMemo(() => {
    if (!visibleAttractions) return [];
    return [...visibleAttractions].sort(
      (a, b) => scoreAt(b.months, month) - scoreAt(a.months, month) || a.name.localeCompare(b.name),
    );
  }, [visibleAttractions, month]);

  return (
    <div>
      <h1 className="text-xl font-bold text-strong">Map of Iceland</h1>
      <p className="mt-1 text-sm text-muted">
        Toggle layers, click anything for details and directions, add stops straight to your trip.
      </p>

      {/* layer chips */}
      <div className="mt-3 -mx-4 flex snap-x gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none]">
        {LAYER_META.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => toggleLayer(key)}
            className={`shrink-0 rounded-full border px-3 py-1 text-sm ${
              layers[key]
                ? "border-aurora/50 bg-aurora/15 font-medium text-strong"
                : "border-border bg-surface text-muted hover:bg-surface-2"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* search */}
      <div className="relative mt-2">
        <SearchIcon size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search places — waterfalls, restaurants, pools, hotels…"
          className="w-full rounded-xl border border-border bg-surface py-2 pl-9 pr-3 text-sm text-fg placeholder:text-muted focus:border-aurora/50"
        />
        {searchResults.length > 0 && (
          <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-border bg-canvas shadow-xl">
            {searchResults.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  if (!layers[r.layer]) toggleLayer(r.layer);
                  setFocusId(null);
                  // let the layer render first, then focus
                  setTimeout(() => setFocusId(r.id), 150);
                  setQuery("");
                }}
                className="block w-full border-b border-border/40 px-3 py-2 text-left text-sm text-fg last:border-0 hover:bg-surface"
              >
                {r.name} <span className="text-xs text-muted">· {r.sub}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {layers.attractions && (
        <div className="mt-2">
          <FilterChips
            options={Object.entries(CATEGORY_META).map(([value, m]) => ({ value, label: m.label }))}
            value={category}
            onChange={setCategory}
          />
        </div>
      )}

      <div className="mt-2">
        <IcelandMap
          attractions={visibleAttractions}
          extended={layers.more ? extended : null}
          pois={activePois}
          routes={routeLayerData}
          conditions={conditionsData}
          hazards={layers.hazards ? (hazards?.points ?? null) : null}
          travelMonth={month}
          focusId={focusId}
          routesOpacity={layers.conditions ? 0.25 : 0.8}
          onAddStop={(seed) => addStop(seed)}
          onPoiHidden={setPoiHidden}
        />
        {poiHidden && (
          <p className="mt-1.5 rounded-lg bg-surface px-3 py-1.5 text-xs text-muted">
            Zoom in to see food, fuel, pools, shops and stays (showing up to 400 in view).
          </p>
        )}
      </div>

      {/* panels */}
      <div className="mt-4 space-y-3">
        {layers.attractions && (
          <Panel title="Attractions" count={attractionRows.length} open>
            <ul className="max-h-96 divide-y divide-border/40 overflow-y-auto">
              {attractionRows.map((a) => (
                <li key={a.id} className="flex items-center gap-2 px-2 py-2">
                  <button onClick={() => setFocusId(a.id)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-medium text-strong hover:text-aurora">{a.name}</p>
                    <p className="text-xs text-muted">
                      {CATEGORY_META[a.category]?.label} · {REGION_NAMES[a.region]}
                    </p>
                  </button>
                  <SeasonBadge item={a} />
                  <AddToTripButton
                    small
                    seed={{ kind: "attraction", refId: a.id, name: a.name, lat: a.lat, lng: a.lng, durationMin: a.durationMin }}
                  />
                </li>
              ))}
            </ul>
          </Panel>
        )}
        {(["food", "fuel", "pool", "grocery", "stay"] as PoiKind[]).map((kind) =>
          layers[kind] && pois[kind] ? (
            <Panel key={kind} title={POI_KIND_META[kind].label} count={pois[kind]!.length}>
              <PoiList pois={pois[kind]!} onFocus={setFocusId} />
            </Panel>
          ) : null,
        )}
      </div>
    </div>
  );
}

function PoiList({ pois, onFocus }: { pois: Poi[]; onFocus: (id: string) => void }) {
  const [near, setNear] = useState<{ lat: number; lng: number } | null>(null);
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    let list = pois;
    if (q.trim()) list = list.filter((p) => matches(q, `${p.name} ${p.town ?? ""} ${p.subkind} ${p.cuisine ?? ""}`));
    if (near) {
      return [...list]
        .map((p) => ({ p, d: haversineKm(near.lat, near.lng, p.lat, p.lng) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 60);
    }
    return list.slice(0, 60).map((p) => ({ p, d: null as number | null }));
  }, [pois, q, near]);

  return (
    <div>
      <div className="flex gap-2 px-2 pb-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by name or town…"
          className="min-w-0 flex-1 rounded-lg border border-border bg-canvas px-2.5 py-1.5 text-sm"
        />
        <button
          onClick={() => {
            if (near) return setNear(null);
            navigator.geolocation?.getCurrentPosition((pos) =>
              setNear({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            );
          }}
          className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-xs ${near ? "border-aurora/50 bg-aurora/15 text-strong" : "border-border text-muted hover:bg-surface-2"}`}
        >
          {near ? "Near me ✓" : "Near me"}
        </button>
      </div>
      <ul className="max-h-80 divide-y divide-border/40 overflow-y-auto">
        {rows.map(({ p, d }) => (
          <li key={p.id} className="flex items-center gap-2 px-2 py-2">
            <button onClick={() => onFocus(p.id)} className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-medium text-strong hover:text-aurora">{p.name}</p>
              <p className="truncate text-xs text-muted">
                {p.subkind.replace(/_/g, " ")}
                {p.town ? ` · ${p.town}` : ""}
                {d !== null ? ` · ${distanceLabel(d)}` : ""}
                {p.hours ? ` · ${p.hours}` : ""}
              </p>
            </button>
            <AddToTripButton small seed={{ kind: "poi", refId: p.id, name: p.name, lat: p.lat, lng: p.lng }} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading map…</p>}>
      <MapPageInner />
    </Suspense>
  );
}

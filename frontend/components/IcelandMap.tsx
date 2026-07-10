"use client";

// The map. Independent layers, each drawn when its data prop is non-null —
// the parent owns toggling (BirdMap's contract, extended):
//   attractions/extended  colored category divIcons + popups
//   pois                  small dots, ZOOM-GATED (>= zoom 9, viewport, cap 400)
//   routes                colored polylines + popups
//   conditions            static road geometry colored by live condition (joins on id)
//   hazards               amber diamonds, topmost
// Leaflet touches `window`, so it's imported dynamically inside the effect
// (the ConcertFinder/BirdTracker static-export pattern). Two extensions:
//   1. popup → React bridge: popups carry <button data-add-stop='json'>;
//      a popupopen handler wires them to onAddStop.
//   2. list → map focus: focusId prop pans to + opens that marker's popup.

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

import { CATEGORY_META, POI_KIND_META } from "@/lib/categories";
import { esc, formatUpdated } from "@/lib/format";
import { scoreAt } from "@/lib/season";
import type {
  Attraction,
  HazardPoint,
  Poi,
  RoadGeometryFile,
  RoadsFile,
  RouteGeometry,
  RouteInfo,
  TripStopSeed,
} from "@/lib/types";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const INK = "#0a0a0b";
const FALLBACK = { lat: 64.95, lng: -18.6, zoom: 6 };
const POI_MIN_ZOOM = 9;
const POI_CAP = 400;

function catIcon(color: string, glyph: string, size: number, muted = false): string {
  return (
    `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${muted ? "transparent" : color};` +
    `border:2px solid ${muted ? color : INK};${muted ? "" : `box-shadow:0 0 0 1px ${color};`}opacity:${muted ? 0.75 : 1};` +
    `display:flex;align-items:center;justify-content:center;color:${muted ? color : INK};` +
    `font:700 ${Math.round(size * 0.55)}px/1 system-ui,sans-serif">${glyph}</div>`
  );
}

function dotIcon(color: string, size: number, square = false): string {
  return (
    `<div style="width:${size}px;height:${size}px;border-radius:${square ? "2px" : "9999px"};background:${color};` +
    `border:1.5px solid ${INK};box-shadow:0 0 0 1px ${color}88"></div>`
  );
}

function hazardIcon(size: number): string {
  const inner = Math.round(size * 0.66);
  return (
    `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center">` +
    `<div style="width:${inner}px;height:${inner}px;background:#f59e0b;border:2px solid ${INK};` +
    `box-shadow:0 0 0 1px #f59e0b;transform:rotate(45deg)"></div></div>`
  );
}

function seasonChipHtml(months: number[] | undefined, m: number): string {
  if (!months) return "";
  const s = scoreAt(months, m);
  const [txt, color] =
    s === 0 ? ["Not accessible now", "#ef4444"] :
    s === 1 ? ["Shoulder season", "#f59e0b"] :
    s === 3 ? ["Peak season", "#10b981"] : ["In season", "#6b7280"];
  return `<span style="display:inline-block;padding:1px 7px;border-radius:999px;font-size:10px;font-weight:600;color:#fff;background:${color}">${txt}</span>`;
}

function addStopButton(seed: TripStopSeed): string {
  return (
    `<button data-add-stop='${esc(JSON.stringify(seed))}' style="border:1px solid #10b981;background:#10b98118;` +
    `color:#059669;font-weight:600;font-size:12px;padding:3px 10px;border-radius:8px;cursor:pointer">+ Add to trip</button>`
  );
}

const gmaps = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

export function IcelandMap({
  attractions,
  extended = null,
  pois = null,
  routes = null,
  conditions = null,
  hazards = null,
  travelMonth,
  focusId = null,
  fitKey = "iceland",
  compact = false,
  routesOpacity = 0.8,
  onAddStop,
  onPoiHidden,
}: {
  attractions: Attraction[] | null;
  extended?: Attraction[] | null;
  pois?: Poi[] | null;
  routes?: { info: RouteInfo; geometry: RouteGeometry }[] | null;
  conditions?: { geometry: RoadGeometryFile; roads: RoadsFile } | null;
  hazards?: HazardPoint[] | null;
  travelMonth: number;
  focusId?: string | null;
  fitKey?: string;
  compact?: boolean;
  routesOpacity?: number;
  onAddStop?: (seed: TripStopSeed) => void;
  /** Called with true when POIs are provided but hidden by the zoom gate. */
  onPoiHidden?: (hidden: boolean) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<string, import("leaflet").Marker>>(new Map());
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const viewRef = useRef<{ center: [number, number]; zoom: number } | null>(null);
  const fitKeyRef = useRef(fitKey);
  if (fitKeyRef.current !== fitKey) {
    fitKeyRef.current = fitKey;
    viewRef.current = null;
  }

  // Latest callbacks without rebuilding the map.
  const onAddStopRef = useRef(onAddStop);
  onAddStopRef.current = onAddStop;
  const onPoiHiddenRef = useRef(onPoiHidden);
  onPoiHiddenRef.current = onPoiHidden;

  useEffect(() => {
    let map: import("leaflet").Map | null = null;
    let cancelled = false;
    const effectFitKey = fitKey;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      const dark = document.documentElement.classList.contains("dark");
      map = L.map(containerRef.current, { scrollWheelZoom: true }).setView(
        [FALLBACK.lat, FALLBACK.lng],
        FALLBACK.zoom,
      );
      mapRef.current = map;
      markersRef.current = new Map();
      L.tileLayer(
        dark
          ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
          maxZoom: 18,
        },
      ).addTo(map);

      // popup → React bridge (extension #1)
      map.on("popupopen", (e) => {
        const el = (e as { popup: { getElement: () => HTMLElement | null } }).popup.getElement();
        el?.querySelectorAll<HTMLButtonElement>("[data-add-stop]").forEach((btn) => {
          btn.addEventListener("click", () => {
            try {
              const seed = JSON.parse(btn.dataset.addStop ?? "") as TripStopSeed;
              onAddStopRef.current?.(seed);
              btn.textContent = "✓ Added";
              btn.disabled = true;
            } catch {
              /* malformed payload — ignore */
            }
          });
        });
      });

      const fitPts: [number, number][] = [];

      // ---- conditions (drawn first: underlay) ------------------------------
      if (conditions) {
        const condById = new Map(conditions.roads.segments.map((s) => [s.id, s]));
        for (const seg of conditions.geometry.segments) {
          const cond = condById.get(seg.id);
          const legend = cond ? conditions.roads.legend[cond.condition] : undefined;
          const color = legend?.color ?? "#6b7280";
          for (const part of seg.parts) {
            const line = L.polyline(part as [number, number][], {
              color,
              weight: 3.5,
              opacity: 0.9,
            }).addTo(map);
            line.bindPopup(
              `<div style="min-width:170px;display:grid;gap:2px">` +
                `<strong>${esc(seg.name || `Road ${seg.road ?? ""}`)}</strong>` +
                `<span style="color:#555">${esc(cond?.label ?? "No data")}${seg.road ? ` · Road ${esc(seg.road)}` : ""}</span>` +
                (cond?.recordedAt ? `<span style="color:#888;font-size:11px">recorded ${esc(formatUpdated(cond.recordedAt))}</span>` : "") +
                `<a href="https://umferdin.is/en" target="_blank" rel="noreferrer" style="color:#0284c7;font-weight:600">Live map (umferdin.is) ↗</a>` +
                `</div>`,
            );
          }
        }
      }

      // ---- routes ----------------------------------------------------------
      if (routes) {
        for (const { info, geometry } of routes) {
          const feature = geometry.features[0];
          if (!feature) continue;
          const latlngs = feature.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
          if (fitKey === `route:${info.id}`) latlngs.forEach((p) => fitPts.push(p));
          const line = L.polyline(latlngs, { color: info.color, weight: 4, opacity: routesOpacity }).addTo(map);
          line.on("mouseover", () => line.setStyle({ weight: 6 }));
          line.on("mouseout", () => line.setStyle({ weight: 4 }));
          line.bindPopup(
            `<div style="min-width:180px;display:grid;gap:3px">` +
              `<strong style="color:${info.color}">${esc(info.name)}</strong>` +
              `<span style="color:#555">${info.distanceKm} km · ~${Math.round(info.driveMin / 60)} h · ${info.daysRecommended} day${info.daysRecommended > 1 ? "s" : ""}</span>` +
              `<span style="color:#888;font-size:11px">${esc(info.seasonNote ?? "")}</span>` +
              `<a href="${BASE}/route/?id=${encodeURIComponent(info.id)}" style="color:#059669;font-weight:600">Route details →</a>` +
              `</div>`,
          );
        }
      }

      // ---- attractions -------------------------------------------------------
      const addAttraction = (a: Attraction, muted: boolean) => {
        const meta = CATEGORY_META[a.category] ?? CATEGORY_META.other;
        const score = scoreAt(a.months, travelMonth);
        const size = muted ? 14 : 18;
        const marker = L.marker([a.lat, a.lng], {
          icon: L.divIcon({
            className: "",
            html: catIcon(meta.color, meta.glyph, size, muted || score === 0),
            iconSize: [size, size],
          }),
          zIndexOffset: muted ? -500 : 0,
        });
        const seed: TripStopSeed = {
          kind: "attraction",
          refId: a.id,
          name: a.name,
          lat: a.lat,
          lng: a.lng,
          durationMin: a.durationMin,
        };
        const detailHref = muted
          ? (a.links?.wikipedia ?? "#")
          : `${BASE}/place/?id=${encodeURIComponent(a.id)}`;
        const lines = [
          `<strong>${esc(a.name)}</strong>`,
          `<span style="color:#555">${esc(meta.label)} · ${esc(a.region)}</span> ${seasonChipHtml(a.months, travelMonth)}`,
          `<span style="color:#666;font-size:12px">${esc((a.description ?? a.extract ?? "").slice(0, 140))}${(a.description ?? a.extract ?? "").length > 140 ? "…" : ""}</span>`,
          muted
            ? `<a href="${esc(detailHref)}" target="_blank" rel="noreferrer" style="color:#059669;font-weight:600">Wikipedia ↗</a>`
            : `<a href="${detailHref}" style="color:#059669;font-weight:600">Details →</a>`,
          onAddStop ? addStopButton(seed) : "",
          `<a href="${gmaps(a.lat, a.lng)}" target="_blank" rel="noreferrer" style="color:#0284c7;font-weight:600">Directions ↗</a>`,
        ].filter(Boolean);
        marker.bindPopup(`<div style="min-width:190px;display:grid;gap:3px">${lines.join("<br>")}</div>`);
        marker.addTo(map!);
        markersRef.current.set(a.id, marker);
        if (!muted) fitPts.push([a.lat, a.lng]);
      };
      for (const a of extended ?? []) addAttraction(a, true);
      for (const a of attractions ?? []) addAttraction(a, false);

      // ---- POIs (zoom-gated, viewport-filtered, capped) ----------------------
      const poiLayer = L.layerGroup().addTo(map);
      const renderPois = () => {
        if (!map || !pois) return;
        poiLayer.clearLayers();
        const gated = map.getZoom() < POI_MIN_ZOOM;
        onPoiHiddenRef.current?.(gated && pois.length > 0);
        if (gated) return;
        const bounds = map.getBounds().pad(0.15);
        let count = 0;
        for (const p of pois) {
          if (count >= POI_CAP) break;
          if (!bounds.contains([p.lat, p.lng])) continue;
          count++;
          const meta = POI_KIND_META[p.kind] ?? POI_KIND_META.food;
          const marker = L.marker([p.lat, p.lng], {
            icon: L.divIcon({
              className: "",
              html: dotIcon(meta.color, p.kind === "fuel" ? 11 : 10, p.kind === "fuel" || p.kind === "grocery"),
              iconSize: [11, 11],
            }),
            zIndexOffset: -200,
          });
          const seed: TripStopSeed = { kind: "poi", refId: p.id, name: p.name, lat: p.lat, lng: p.lng };
          const lines = [
            `<strong>${esc(p.name)}</strong>`,
            `<span style="color:#555">${esc(meta.label)}${p.subkind && p.subkind !== p.kind ? ` · ${esc(p.subkind.replace(/_/g, " "))}` : ""}${p.cuisine ? ` · ${esc(p.cuisine.split(";").slice(0, 2).join(", "))}` : ""}</span>`,
            p.hours ? `<span style="color:#888;font-size:11px">Hours: ${esc(p.hours)}</span>` : "",
            p.website ? `<a href="${esc(p.website)}" target="_blank" rel="noreferrer" style="color:#059669;font-weight:600">Website ↗</a>` : "",
            onAddStop ? addStopButton(seed) : "",
            `<a href="${gmaps(p.lat, p.lng)}" target="_blank" rel="noreferrer" style="color:#0284c7;font-weight:600">Directions ↗</a>`,
          ].filter(Boolean);
          marker.bindPopup(`<div style="min-width:180px;display:grid;gap:3px">${lines.join("<br>")}</div>`);
          marker.addTo(poiLayer);
          markersRef.current.set(p.id, marker);
        }
      };
      renderPois();
      map.on("moveend zoomend", renderPois);

      // ---- hazards (topmost) --------------------------------------------------
      for (const h of hazards ?? []) {
        const marker = L.marker([h.lat, h.lng], {
          icon: L.divIcon({ className: "", html: hazardIcon(18), iconSize: [18, 18] }),
          zIndexOffset: 1000,
        });
        marker.bindPopup(
          `<div style="min-width:170px;display:grid;gap:2px">` +
            `<strong style="color:#b45309">⚠ ${esc(h.title ?? h.type)}</strong>` +
            (h.description ? `<span style="color:#555">${esc(h.description)}</span>` : "") +
            `<span style="color:#888;font-size:11px">via safetravel.is / road.is</span></div>`,
        );
        marker.addTo(map);
      }

      // Restore previous view, else fit to data.
      if (viewRef.current) {
        map.setView(viewRef.current.center, viewRef.current.zoom, { animate: false });
      } else if (fitPts.length > 0) {
        map.fitBounds(fitPts, { padding: [30, 30], maxZoom: 11, animate: false });
      }
      map.on("moveend", () => {
        if (map) {
          viewRef.current = { center: [map.getCenter().lat, map.getCenter().lng], zoom: map.getZoom() };
        }
      });
    })();

    return () => {
      cancelled = true;
      if (map) {
        if (fitKeyRef.current === effectFitKey) {
          viewRef.current = { center: [map.getCenter().lat, map.getCenter().lng], zoom: map.getZoom() };
        }
        map.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attractions, extended, pois, routes, conditions, hazards, travelMonth, fitKey]);

  // list → map focus (extension #2)
  useEffect(() => {
    if (!focusId) return;
    const marker = markersRef.current.get(focusId);
    const map = mapRef.current;
    if (marker && map) {
      map.setView(marker.getLatLng(), Math.max(map.getZoom(), 11), { animate: true });
      marker.openPopup();
    }
  }, [focusId]);

  return (
    <div
      ref={containerRef}
      className={`w-full overflow-hidden rounded-xl border border-border ${
        compact ? "h-[42vh] min-h-[300px]" : "h-[55vh] min-h-[380px] md:h-[62vh]"
      }`}
      style={{ zIndex: 0 }}
      aria-label="Map of Iceland"
    />
  );
}

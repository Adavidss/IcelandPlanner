"use client";

// Safety: live road conditions map + legend, weather strip, Reynisfjara,
// webcams, seasonal checklist. Live data degrades gracefully to deep links.

import { useEffect, useMemo, useState } from "react";

import { IcelandMap } from "@/components/IcelandMap";
import {
  AlertsBanner, ChecklistCard, ConditionsLegend, FreshnessLine, ReynisfjaraCard, WeatherStrip,
} from "@/components/safety";
import { getRoadGeometry } from "@/lib/api";
import { EXTERNAL, getHazards, getLiveStatus, getRoads, getWeather, liveFreshness } from "@/lib/live";
import { useSeason } from "@/lib/season-context";
import type { HazardsFile, LiveStatus, RoadGeometryFile, RoadsFile, WeatherFile } from "@/lib/types";

export default function SafetyPage() {
  const { month } = useSeason();
  const [roads, setRoads] = useState<RoadsFile | null>(null);
  const [geometry, setGeometry] = useState<RoadGeometryFile | null>(null);
  const [weather, setWeather] = useState<WeatherFile | null>(null);
  const [hazards, setHazards] = useState<HazardsFile | null>(null);
  const [status, setStatus] = useState<LiveStatus | null>(null);
  const [polled, setPolled] = useState(false);

  useEffect(() => {
    const load = () => {
      getRoads().then(setRoads);
      getWeather().then(setWeather);
      getHazards().then(setHazards);
      getLiveStatus().then((s) => {
        setStatus(s);
        setPolled(true);
      });
    };
    load();
    const interval = setInterval(load, 10 * 60_000); // re-poll while open
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    getRoadGeometry().then((g) => setGeometry(g.segments.length > 0 ? g : null));
  }, []);

  const freshness = liveFreshness(status);
  const conditions = useMemo(
    () => (roads && geometry ? { geometry, roads } : null),
    [roads, geometry],
  );

  const troubleCounts = roads
    ? (["difficult", "extremely_difficult", "impassable", "closed", "mountain"] as const)
        .map((k) => ({ k, n: roads.counts[k] ?? 0, meta: roads.legend[k] }))
        .filter(({ n }) => n > 0)
    : [];

  return (
    <div>
      <h1 className="text-xl font-bold text-strong">Road & travel safety</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Iceland&apos;s weather writes the itinerary. Check this (and the official sources) every morning before
        you drive — especially October through April.
      </p>

      <div className="mt-4">
        <AlertsBanner />
      </div>

      {polled && freshness !== "fresh" && (
        <div className="mb-4 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm">
          <p className="font-medium text-warn">
            {freshness === "stale" ? "Live data is stale (pipeline hasn't refreshed recently)." : "Live data isn't available right now."}
          </p>
          <p className="mt-0.5 text-fg">
            Use the official sources directly:{" "}
            <a href={EXTERNAL.roads} target="_blank" rel="noreferrer" className="font-medium text-aurora hover:underline">umferdin.is</a>
            {" · "}
            <a href={EXTERNAL.weather} target="_blank" rel="noreferrer" className="font-medium text-aurora hover:underline">vedur.is</a>
            {" · "}
            <a href={EXTERNAL.safetravel} target="_blank" rel="noreferrer" className="font-medium text-aurora hover:underline">safetravel.is</a>
          </p>
        </div>
      )}

      {/* live condition summary chips */}
      {troubleCounts.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {troubleCounts.map(({ k, n, meta }) => (
            <span key={k} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-sm text-fg">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta?.color }} />
              {n} {meta?.label.toLowerCase() ?? k}
            </span>
          ))}
        </div>
      )}

      <IcelandMap
        attractions={null}
        conditions={conditions}
        hazards={hazards?.points ?? null}
        travelMonth={month}
        fitKey="safety"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        {roads ? <ConditionsLegend roads={roads} /> : <p className="text-xs text-muted">Road conditions load from the live data pipeline once it has run.</p>}
        <FreshnessLine updatedAt={roads?.updated_at} linkHref={EXTERNAL.roads} linkLabel="Live map (umferdin.is)" />
      </div>

      <h2 className="mt-7 text-lg font-semibold text-strong">Weather across the country</h2>
      {weather && weather.stations.length > 0 ? (
        <>
          <p className="mt-0.5 mb-2 text-xs text-muted">Wind first — in Iceland, wind is the forecast that matters. Amber ≥ 15 m/s, red ≥ 20 m/s.</p>
          <WeatherStrip stations={weather.stations} />
          <FreshnessLine updatedAt={weather.updated_at} linkHref={EXTERNAL.weather} linkLabel="Full forecast (vedur.is)" />
        </>
      ) : (
        <p className="mt-2 text-sm text-muted">
          Forecast strip loads from the live pipeline — meanwhile see{" "}
          <a href={EXTERNAL.weather} target="_blank" rel="noreferrer" className="text-aurora hover:underline">vedur.is ↗</a>
        </p>
      )}

      <div className="mt-7 grid grid-cols-1 gap-3 md:grid-cols-2">
        <ReynisfjaraCard hazards={hazards} />
        <ChecklistCard />
      </div>

      <h2 className="mt-7 text-lg font-semibold text-strong">Webcams & official sources</h2>
      <ul className="mt-2 space-y-1.5 text-sm">
        {EXTERNAL.webcams.map((w) => (
          <li key={w.url}>
            <a href={w.url} target="_blank" rel="noreferrer" className="text-aurora hover:underline">{w.name} ↗</a>
          </li>
        ))}
        <li><a href={EXTERNAL.alerts112} target="_blank" rel="noreferrer" className="text-aurora hover:underline">112 Iceland app (emergency + check-in) ↗</a></li>
        <li><a href={EXTERNAL.aurora} target="_blank" rel="noreferrer" className="text-aurora hover:underline">Aurora & cloud-cover forecast (vedur.is) ↗</a></li>
      </ul>
    </div>
  );
}

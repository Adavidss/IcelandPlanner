"use client";

// Route detail (?id=): map fitted to the polyline, ordered stops with per-leg
// estimates + Google Maps links, bulk "add all stops to trip".

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { IcelandMap } from "@/components/IcelandMap";
import { MonthBars } from "@/components/MonthBars";
import { SeasonBadge } from "@/components/SeasonBadge";
import { CheckIcon, PlusIcon } from "@/components/icons";
import { EmptyState } from "@/components/ui";
import { getAttractions, getRouteGeometry, getRoutes } from "@/lib/api";
import { driveEstimate } from "@/lib/geo";
import { dayRouteUrl, legUrl } from "@/lib/maps";
import { useSeason } from "@/lib/season-context";
import { useTrip } from "@/lib/trip";
import type { Attraction, RouteGeometry, RouteInfo } from "@/lib/types";

function RouteDetail() {
  const params = useSearchParams();
  const id = params.get("id");
  const { month } = useSeason();
  const { bulkAdd } = useTrip();
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [geometry, setGeometry] = useState<RouteGeometry | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [bulkAdded, setBulkAdded] = useState(false);

  useEffect(() => {
    getRoutes().then((f) => {
      setRoutes(f.routes);
      setLoaded(true);
    });
    getAttractions().then((f) => setAttractions(f.attractions));
  }, []);

  const route = useMemo(() => routes.find((r) => r.id === id) ?? null, [routes, id]);

  useEffect(() => {
    if (route) getRouteGeometry(route.id).then(setGeometry);
  }, [route]);

  const byId = useMemo(() => new Map(attractions.map((a) => [a.id, a])), [attractions]);
  const stops = useMemo(
    () => (route ? route.stops.map((s) => byId.get(s)).filter((a): a is Attraction => !!a) : []),
    [route, byId],
  );

  if (!id) return <EmptyState>No route selected — <Link href="/routes" className="text-aurora hover:underline">see the routes</Link>.</EmptyState>;
  if (!loaded) return <p className="text-sm text-muted">Loading…</p>;
  if (!route) return <EmptyState>Route not found — <Link href="/routes" className="text-aurora hover:underline">see the routes</Link>.</EmptyState>;

  const gmapsAll = dayRouteUrl(stops.map((a) => ({ lat: a.lat, lng: a.lng })));

  const addAllToTrip = () => {
    if (bulkAdded) return;
    bulkAdd(
      `${route.name} trip`,
      stops.map((a) => ({
        kind: "attraction" as const,
        refId: a.id,
        name: a.name,
        lat: a.lat,
        lng: a.lng,
        durationMin: a.durationMin,
      })),
      route.dayBreaks ?? [],
    );
    setBulkAdded(true);
    setTimeout(() => setBulkAdded(false), 2500);
  };

  return (
    <div>
      <Link href="/routes" className="text-sm text-muted hover:text-fg">← All routes</Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-strong">
            <span className="h-3.5 w-3.5 rounded-full" style={{ background: route.color }} />
            {route.name}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {route.distanceKm} km · ~{Math.round(route.driveMin / 60)} h driving · best over {route.daysRecommended} day
            {route.daysRecommended > 1 ? "s" : ""} · starts {route.start}
            {route.loop ? " · loop" : ""}
          </p>
        </div>
        <SeasonBadge item={route} />
      </div>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-fg">{route.description}</p>
      {route.seasonNote && <p className="mt-1.5 text-xs text-muted">{route.seasonNote}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={addAllToTrip}
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold ${
            bulkAdded ? "bg-aurora/15 text-aurora" : "bg-aurora text-black hover:bg-aurora-dim"
          }`}
        >
          {bulkAdded ? (<><CheckIcon size={14} /> Added to your trip</>) : (<><PlusIcon size={14} /> Add all stops to trip</>)}
        </button>
        {gmapsAll && (
          <a
            href={gmapsAll.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-ice/40 bg-ice/10 px-4 py-2 text-sm font-medium text-ice hover:bg-ice/20"
          >
            Drive it in Google Maps ↗{gmapsAll.included < gmapsAll.total ? ` (${gmapsAll.included}/${gmapsAll.total} stops)` : ""}
          </a>
        )}
      </div>

      <div className="mt-4">
        <IcelandMap
          attractions={stops}
          routes={geometry && geometry.features.length > 0 ? [{ info: route, geometry }] : null}
          travelMonth={month}
          fitKey={`route:${route.id}`}
        />
      </div>

      <h2 className="mt-6 text-lg font-semibold text-strong">Stops in order</h2>
      <ol className="mt-3 space-y-1.5">
        {stops.map((a, i) => {
          const prev = stops[i - 1];
          const est = prev ? driveEstimate(prev.lat, prev.lng, a.lat, a.lng, month) : null;
          const newDay = (route.dayBreaks ?? []).includes(i);
          return (
            <li key={a.id}>
              {newDay && (
                <p className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">
                  Day {(route.dayBreaks ?? []).filter((b) => b <= i).length + 1} suggested
                </p>
              )}
              {est && (
                <p className="ml-9 py-0.5 text-[11px] text-muted">
                  ↓ {est.label}
                  {prev && (
                    <a href={legUrl({ lat: prev.lat, lng: prev.lng }, { lat: a.lat, lng: a.lng })} target="_blank" rel="noreferrer" className="ml-2 text-ice hover:underline">
                      directions ↗
                    </a>
                  )}
                </p>
              )}
              <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-black" style={{ background: route.color }}>
                  {i + 1}
                </span>
                <Link href={`/place/?id=${encodeURIComponent(a.id)}`} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-strong hover:text-aurora">{a.name}</p>
                  <p className="truncate text-xs text-muted">{a.description}</p>
                </Link>
                <SeasonBadge item={a} />
              </div>
            </li>
          );
        })}
      </ol>

      <h2 className="mt-6 text-sm font-semibold text-strong">Best months for this route</h2>
      <div className="mt-2 max-w-md">
        <MonthBars months={route.months} />
      </div>
    </div>
  );
}

export default function RoutePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <RouteDetail />
    </Suspense>
  );
}

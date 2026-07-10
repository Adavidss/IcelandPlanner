"use client";

// Attraction detail (?id=<slug>): photo, description, MonthBars, practical
// facts, nearby food & fuel, map, links.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { AddToTripButton } from "@/components/AddToTripButton";
import { IcelandMap } from "@/components/IcelandMap";
import { MonthBars } from "@/components/MonthBars";
import { SeasonBadge } from "@/components/SeasonBadge";
import { AttractionCard } from "@/components/cards";
import { ExternalIcon } from "@/components/icons";
import { CardRail, EmptyState } from "@/components/ui";
import { getAttractions, getPoi } from "@/lib/api";
import { CATEGORY_META } from "@/lib/categories";
import { httpUrl } from "@/lib/format";
import { distanceLabel, haversineKm } from "@/lib/geo";
import { legUrl } from "@/lib/maps";
import { useSeason } from "@/lib/season-context";
import { REGION_NAMES } from "@/lib/types";
import type { Attraction, Poi } from "@/lib/types";

const ACCESS_LABEL: Record<string, string> = {
  paved: "Paved road access",
  gravel: "Gravel road access",
  f_road: "F-road (4x4 only, summer only)",
  hike: "Reached on foot",
};

function PlaceDetail() {
  const params = useSearchParams();
  const id = params.get("id");
  const { month } = useSeason();
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [food, setFood] = useState<Poi[]>([]);
  const [fuel, setFuel] = useState<Poi[]>([]);

  useEffect(() => {
    getAttractions().then((f) => {
      setAttractions(f.attractions);
      setLoaded(true);
    });
    getPoi("food").then((f) => setFood(f.poi));
    getPoi("fuel").then((f) => setFuel(f.poi));
  }, []);

  const a = useMemo(() => attractions.find((x) => x.id === id) ?? null, [attractions, id]);

  const nearby = useMemo(() => {
    if (!a) return { food: [], fuel: [] };
    const near = (list: Poi[]) =>
      list
        .map((p) => ({ p, d: haversineKm(a.lat, a.lng, p.lat, p.lng) }))
        .filter(({ d }) => d <= 20)
        .sort((x, y) => x.d - y.d)
        .slice(0, 5);
    return { food: near(food), fuel: near(fuel) };
  }, [a, food, fuel]);

  const related = useMemo(() => {
    if (!a) return [];
    return attractions
      .filter((x) => x.id !== a.id)
      .map((x) => ({ x, d: haversineKm(a.lat, a.lng, x.lat, x.lng) }))
      .sort((p, q) => p.d - q.d)
      .slice(0, 8)
      .map(({ x }) => x);
  }, [a, attractions]);

  if (!id) return <EmptyState>No place selected — <Link href="/map" className="text-aurora hover:underline">explore the map</Link>.</EmptyState>;
  if (!loaded) return <p className="text-sm text-muted">Loading…</p>;
  if (!a) return <EmptyState>Place not found — <Link href="/map" className="text-aurora hover:underline">explore the map</Link>.</EmptyState>;

  const meta = CATEGORY_META[a.category] ?? CATEGORY_META.other;
  const img = a.photo?.src ?? a.thumbnail ?? null;

  return (
    <div>
      <Link href="/map" className="text-sm text-muted hover:text-fg">← Map</Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-strong">{a.name}</h1>
          <p className="mt-1 text-sm text-muted">
            <span style={{ color: meta.color }}>{meta.label}</span> · {REGION_NAMES[a.region]}
            {a.nameIs && a.nameIs !== a.name && <> · {a.nameIs}</>}
          </p>
        </div>
        <SeasonBadge item={a} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          {img && (
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt={a.name} className="max-h-96 w-full rounded-xl border border-border object-cover" onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }} />
              {a.photo?.credit && <figcaption className="mt-1 text-[11px] text-muted">{a.photo.credit} ({a.photo.license})</figcaption>}
            </figure>
          )}
          <p className="mt-4 text-sm leading-relaxed text-fg">{a.description}</p>
          {a.extract && a.extract !== a.description && (
            <p className="mt-2 text-sm leading-relaxed text-muted">{a.extract}</p>
          )}
          {a.seasonNote && (
            <p className="mt-3 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-fg">
              <span className="font-medium text-warn">Season note:</span> {a.seasonNote}
            </p>
          )}

          <h2 className="mt-5 text-sm font-semibold text-strong">Best months</h2>
          <div className="mt-2">
            <MonthBars months={a.months} />
          </div>

          <div className="mt-5">
            <IcelandMap
              attractions={[a]}
              travelMonth={month}
              compact
              fitKey={`place:${a.id}`}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-surface p-4">
            <dl className="space-y-2 text-sm">
              {a.access && (
                <div className="flex justify-between gap-2"><dt className="text-muted">Access</dt><dd className={`text-right ${a.access === "f_road" ? "font-medium text-warn" : "text-fg"}`}>{ACCESS_LABEL[a.access]}</dd></div>
              )}
              {a.durationMin !== undefined && (
                <div className="flex justify-between"><dt className="text-muted">Typical visit</dt><dd className="text-fg">~{a.durationMin} min</dd></div>
              )}
              <div className="flex justify-between"><dt className="text-muted">Entry</dt><dd className="text-fg">{a.fee ? (a.feeNote ?? "Paid") : "Free"}</dd></div>
            </dl>
            <div className="mt-3 flex flex-col gap-2">
              <AddToTripButton seed={{ kind: "attraction", refId: a.id, name: a.name, lat: a.lat, lng: a.lng, durationMin: a.durationMin }} />
              <a
                href={legUrl(null, { lat: a.lat, lng: a.lng })}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-ice/40 bg-ice/10 px-3 py-1.5 text-sm font-medium text-ice hover:bg-ice/20"
              >
                Directions in Google Maps <ExternalIcon />
              </a>
              {httpUrl(a.links?.official) && (
                <a href={httpUrl(a.links?.official)!} target="_blank" rel="noreferrer" className="text-sm text-aurora hover:underline">Official site ↗</a>
              )}
              {httpUrl(a.links?.wikipedia) && (
                <a href={httpUrl(a.links?.wikipedia)!} target="_blank" rel="noreferrer" className="text-sm text-aurora hover:underline">Wikipedia ↗</a>
              )}
            </div>
          </div>

          {(nearby.food.length > 0 || nearby.fuel.length > 0) && (
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="text-sm font-semibold text-strong">Nearby food & fuel</p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {nearby.food.map(({ p, d }) => (
                  <li key={p.id} className="flex justify-between gap-2">
                    <span className="truncate text-fg">{p.name}</span>
                    <span className="shrink-0 text-xs text-muted">{distanceLabel(d)}</span>
                  </li>
                ))}
                {nearby.fuel.slice(0, 2).map(({ p, d }) => (
                  <li key={p.id} className="flex justify-between gap-2">
                    <span className="truncate text-fg">⛽ {p.name}</span>
                    <span className="shrink-0 text-xs text-muted">{distanceLabel(d)}</span>
                  </li>
                ))}
              </ul>
              <Link href="/map/?layer=food" className="mt-2 inline-block text-xs font-medium text-aurora hover:underline">
                All food & fuel on the map →
              </Link>
            </div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-semibold text-strong">Nearby places</h2>
          <div className="mt-3">
            <CardRail>{related.map((x) => <AttractionCard key={x.id} a={x} compact />)}</CardRail>
          </div>
        </>
      )}
    </div>
  );
}

export default function PlacePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <PlaceDetail />
    </Suspense>
  );
}

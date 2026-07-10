"use client";

// Home: orientation for a first-time visitor. The month picker hero seeds the
// season context; the conditions strip shows today-in-Iceland; discovery rows
// adapt to the chosen month.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AuroraPanel, MidnightSunCard } from "@/components/AuroraPanel";
import { DaylightCard } from "@/components/DaylightCard";
import { AttractionCard, RouteCard, TourCard } from "@/components/cards";
import { AlertsBanner } from "@/components/safety";
import { CardRail, EmptyState, Section } from "@/components/ui";
import { getAttractions, getRoutes, getTours } from "@/lib/api";
import { getRoads, getWeather } from "@/lib/live";
import { goodInMonth, inSeason, isMidnightSunMonth, lastChance, MONTH_NAMES, MONTH_SHORT, monthTheme } from "@/lib/season";
import { useSeason } from "@/lib/season-context";
import { useTrip } from "@/lib/trip";
import type { Attraction, RoadsFile, RouteInfo, Tour, WeatherFile } from "@/lib/types";

export default function HomePage() {
  const { month, source, setMonth, date } = useSeason();
  const { activeTrip, ready: tripReady } = useTrip();
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [tours, setTours] = useState<Tour[]>([]);
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [roads, setRoads] = useState<RoadsFile | null>(null);
  const [weather, setWeather] = useState<WeatherFile | null>(null);

  useEffect(() => {
    getAttractions().then((f) => setAttractions(f.attractions));
    getTours().then((f) => setTours(f.tours));
    getRoutes().then((f) => setRoutes(f.routes));
    getRoads().then(setRoads);
    getWeather().then(setWeather);
  }, []);

  const peak = useMemo(() => goodInMonth(attractions, month, 3).slice(0, 10), [attractions, month]);
  const fading = useMemo(() => lastChance(attractions, month).slice(0, 10), [attractions, month]);
  const monthTours = useMemo(
    () => tours.filter((t) => inSeason(t, month)).slice(0, 10),
    [tours, month],
  );
  const theme = monthTheme(month);
  const themed = useMemo(
    () => attractions.filter((a) => a.tags?.includes(theme.tag) && inSeason(a, month)).slice(0, 10),
    [attractions, month, theme.tag],
  );

  const badRoads = roads
    ? (roads.counts.difficult ?? 0) + (roads.counts.extremely_difficult ?? 0) + (roads.counts.impassable ?? 0) + (roads.counts.closed ?? 0)
    : null;
  const rvkNow = weather?.stations.find((s) => s.id === 1)?.forecast[0] ?? null;

  const stopCount = activeTrip?.days.reduce((acc, d) => acc + d.stops.length, 0) ?? 0;

  return (
    <div>
      <AlertsBanner />

      {/* hero */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-surface to-surface-2/60 p-6 md:p-8">
        <h1 className="text-2xl font-bold text-strong md:text-3xl">Plan your Iceland trip</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted md:text-base">
          Iceland in {MONTH_NAMES[month]} is its own country — daylight, roads, aurora and puffins all change with
          the calendar. Pick your month and everything here adapts.
        </p>
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">When are you going?</p>
          <div className="flex flex-wrap gap-1.5">
            {MONTH_SHORT.map((m, i) => (
              <button
                key={m}
                onClick={() => setMonth(i === month && source === "picked" ? null : i)}
                className={`rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                  i === month
                    ? "bg-aurora/20 font-semibold text-strong ring-1 ring-aurora/60"
                    : "bg-canvas/60 text-muted hover:bg-surface-2 hover:text-fg"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/map"
            className="rounded-lg bg-aurora px-4 py-2 text-sm font-semibold text-black hover:bg-aurora-dim"
          >
            Explore the map
          </Link>
          <Link
            href="/plan"
            className="rounded-lg border border-border bg-canvas/60 px-4 py-2 text-sm font-medium text-fg hover:bg-surface-2"
          >
            {tripReady && activeTrip && stopCount > 0
              ? `Continue "${activeTrip.name}" · ${activeTrip.days.length} day${activeTrip.days.length > 1 ? "s" : ""} · ${stopCount} stop${stopCount > 1 ? "s" : ""}`
              : "Start your itinerary"}
          </Link>
        </div>
      </div>

      {/* today-in-Iceland strip */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DaylightCard date={date} />
        {rvkNow ? (
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm font-medium text-strong">Weather · Reykjavík</p>
            <p className="mt-2 text-2xl font-semibold text-strong">
              {rvkNow.windMs ?? "–"} <span className="text-sm font-normal text-muted">m/s {rvkNow.windDir ?? ""}</span>
            </p>
            <p className="mt-1 text-sm text-muted">
              {rvkNow.tempC !== null ? `${rvkNow.tempC}°C` : ""} {rvkNow.desc ?? ""}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm font-medium text-strong">Weather</p>
            <p className="mt-2 text-sm text-muted">
              Live forecast loads once the data pipeline has run — see{" "}
              <a href="https://en.vedur.is" target="_blank" rel="noreferrer" className="text-aurora hover:underline">vedur.is ↗</a>
            </p>
          </div>
        )}
        <Link href="/safety" className="rounded-xl border border-border bg-surface p-4 hover:border-aurora/40">
          <p className="text-sm font-medium text-strong">Roads now</p>
          {badRoads !== null ? (
            <>
              <p className={`mt-2 text-2xl font-semibold ${badRoads > 0 ? "text-warn" : "text-aurora"}`}>
                {badRoads === 0 ? "All clear" : `${badRoads} segments`}
              </p>
              <p className="mt-1 text-sm text-muted">
                {badRoads === 0 ? "No difficult or closed segments reported" : "difficult, impassable or closed → details"}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">Live conditions on the Safety page →</p>
          )}
        </Link>
        {isMidnightSunMonth(month) ? <MidnightSunCard /> : <AuroraPanel />}
      </div>

      {/* discovery rows */}
      <Section title={`Peak in ${MONTH_NAMES[month]}`} blurb="At their absolute best for your dates." seeAll={{ href: "/map" }}>
        {peak.length > 0 ? (
          <CardRail>{peak.map((a) => <AttractionCard key={a.id} a={a} compact />)}</CardRail>
        ) : (
          <EmptyState>Attraction data loads after the first data build.</EmptyState>
        )}
      </Section>

      <Section title={theme.title} blurb={theme.blurb}>
        {themed.length > 0 ? (
          <CardRail>{themed.map((a) => <AttractionCard key={a.id} a={a} compact />)}</CardRail>
        ) : (
          <EmptyState>Nothing themed for this month yet.</EmptyState>
        )}
      </Section>

      <Section title={`Tours running in ${MONTH_NAMES[month]}`} blurb="Bookable day tours from Reykjavik Excursions." seeAll={{ href: "/tours" }}>
        {monthTours.length > 0 ? (
          <CardRail>{monthTours.map((t) => <TourCard key={t.slug} tour={t} compact />)}</CardRail>
        ) : (
          <EmptyState>Tour data loads after the first data build.</EmptyState>
        )}
      </Section>

      {fading.length > 0 && (
        <Section title="Last chance" blurb={`Fading out after ${MONTH_NAMES[month]} — catch them before the season turns.`}>
          <CardRail>{fading.map((a) => <AttractionCard key={a.id} a={a} compact />)}</CardRail>
        </Section>
      )}

      <Section title="The classic routes" blurb="Iceland organizes itself into a handful of legendary drives." seeAll={{ href: "/routes" }}>
        {routes.length > 0 ? (
          <CardRail>{routes.map((r) => <RouteCard key={r.id} route={r} compact />)}</CardRail>
        ) : (
          <EmptyState>Route data loads after the first data build.</EmptyState>
        )}
      </Section>
    </div>
  );
}

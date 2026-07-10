"use client";

// Planner building blocks: TripPicker (named-trip switcher with tap-again
// delete), TripDayCard (date + drive/daylight summary + seasonal warnings),
// TripStopRow (up/down reorder, move-to-day, per-leg estimates).

import { useState } from "react";

import { AttractionQuickView } from "@/components/AttractionQuickView";
import { DaylightCard } from "@/components/DaylightCard";
import { SeasonBadge } from "@/components/SeasonBadge";
import { ArrowDownIcon, ArrowUpIcon, CarIcon, TrashIcon } from "@/components/icons";
import { formatTripDate } from "@/lib/format";
import { daylightFor, REYKJAVIK } from "@/lib/daylight";
import { driveEstimate, formatDriveMinutes } from "@/lib/geo";
import { dayRouteUrl, legUrl } from "@/lib/maps";
import { scoreAt } from "@/lib/season";
import { dateForDay, useTrip } from "@/lib/trip";
import type { Attraction, StationForecast, Trip, TripDay, TripStop } from "@/lib/types";

// ---------- TripPicker --------------------------------------------------------

export function TripPicker() {
  const { trips, activeTrip, setActive, createTrip, deleteTrip, renameTrip } = useTrip();
  const [armedDelete, setArmedDelete] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {trips.length > 0 && (
        <select
          value={activeTrip?.id ?? ""}
          onChange={(e) => setActive(e.target.value)}
          className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-fg"
          aria-label="Switch trip"
        >
          {trips.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}
      <button
        onClick={() => {
          const name = window.prompt("Name your trip", trips.length === 0 ? "My Iceland trip" : "Another Iceland trip");
          if (name?.trim()) createTrip(name.trim());
        }}
        className="rounded-lg border border-aurora/40 bg-aurora/10 px-2.5 py-1.5 text-sm font-medium text-aurora hover:bg-aurora/20"
      >
        + New trip
      </button>
      {activeTrip && (
        <>
          <button
            onClick={() => {
              if (renaming) return;
              setRenaming(true);
              const name = window.prompt("Rename trip", activeTrip.name);
              if (name?.trim()) renameTrip(activeTrip.id, name.trim());
              setRenaming(false);
            }}
            className="rounded-lg border border-border px-2.5 py-1.5 text-sm text-muted hover:bg-surface"
          >
            Rename
          </button>
          <button
            onClick={() => {
              if (armedDelete === activeTrip.id) {
                deleteTrip(activeTrip.id);
                setArmedDelete(null);
              } else {
                setArmedDelete(activeTrip.id);
                setTimeout(() => setArmedDelete(null), 2000);
              }
            }}
            className={`rounded-lg border px-2.5 py-1.5 text-sm ${
              armedDelete === activeTrip.id
                ? "border-danger bg-danger/15 font-medium text-danger"
                : "border-border text-muted hover:bg-surface"
            }`}
          >
            {armedDelete === activeTrip.id ? "Sure? Tap again" : "Delete"}
          </button>
        </>
      )}
    </div>
  );
}

// ---------- TripStopRow ---------------------------------------------------------

function TripStopRow({
  trip,
  dayIndex,
  stop,
  stopIndex,
  month,
  attractionById,
}: {
  trip: Trip;
  dayIndex: number;
  stop: TripStop;
  stopIndex: number;
  month: number;
  attractionById: Map<string, Attraction>;
}) {
  const { moveStop, moveStopToDay, removeStop, setStopField } = useTrip();
  const [showCard, setShowCard] = useState(false);
  const day = trip.days[dayIndex];
  const ref = stop.kind === "attraction" && stop.refId ? attractionById.get(stop.refId) : undefined;

  // Warning: this stop is closed/f-road for the trip month.
  const score = ref ? scoreAt(ref.months, month) : null;
  const warn =
    score === 0
      ? ref?.tags?.includes("fRoad")
        ? "F-road access — closed for these dates"
        : "Likely closed / inaccessible this month"
      : null;

  return (
    <li className="rounded-lg border border-border/70 bg-canvas px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="w-5 shrink-0 text-center text-xs font-semibold text-muted">{stopIndex + 1}</span>
        <div className="min-w-0 flex-1">
          {ref ? (
            <button
              onClick={() => setShowCard(true)}
              className="block max-w-full truncate text-left text-sm font-medium text-strong underline-offset-2 hover:text-aurora hover:underline"
              title={`About ${stop.name}`}
            >
              {stop.name}
            </button>
          ) : (
            <p className="truncate text-sm font-medium text-strong">{stop.name}</p>
          )}
          <p className="text-[11px] text-muted">
            {stop.kind}
            {stop.durationMin ? ` · ~${stop.durationMin} min visit` : ""}
          </p>
        </div>
        {ref && <SeasonBadge item={ref} month={month} />}
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => moveStop(trip.id, dayIndex, stopIndex, -1)}
            disabled={stopIndex === 0}
            className="rounded p-1 text-muted hover:bg-surface disabled:opacity-30"
            aria-label="Move up"
          >
            <ArrowUpIcon />
          </button>
          <button
            onClick={() => moveStop(trip.id, dayIndex, stopIndex, 1)}
            disabled={stopIndex === day.stops.length - 1}
            className="rounded p-1 text-muted hover:bg-surface disabled:opacity-30"
            aria-label="Move down"
          >
            <ArrowDownIcon />
          </button>
          {trip.days.length > 1 && (
            <select
              value={dayIndex}
              onChange={(e) => moveStopToDay(trip.id, dayIndex, stop.id, Number(e.target.value))}
              className="rounded border border-border bg-surface px-1 py-0.5 text-[11px] text-muted"
              aria-label="Move to day"
            >
              {trip.days.map((_, i) => (
                <option key={i} value={i}>
                  D{i + 1}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => removeStop(trip.id, dayIndex, stop.id)}
            className="rounded p-1 text-muted hover:bg-surface hover:text-danger"
            aria-label="Remove stop"
          >
            <TrashIcon size={14} />
          </button>
        </div>
      </div>
      {warn && <p className="ml-7 mt-1 text-xs font-medium text-danger">⚠ {warn}</p>}
      {showCard && ref && <AttractionQuickView a={ref} month={month} onClose={() => setShowCard(false)} />}
      {stop.lat !== null && stop.lng !== null && (
        <p className="ml-7 mt-0.5">
          <a
            href={legUrl(null, { lat: stop.lat, lng: stop.lng })}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-ice hover:underline"
          >
            Directions ↗
          </a>
          <button
            onClick={() => {
              const v = window.prompt("Planned visit length (minutes)", String(stop.durationMin ?? 60));
              const n = Number(v);
              if (v !== null && Number.isFinite(n) && n >= 0) setStopField(trip.id, dayIndex, stop.id, { durationMin: n });
            }}
            className="ml-3 text-[11px] text-muted hover:text-fg hover:underline"
          >
            Set visit time
          </button>
        </p>
      )}
    </li>
  );
}

// ---------- TripDayCard -----------------------------------------------------------

export function TripDayCard({
  trip,
  day,
  dayIndex,
  month,
  attractionById,
  stations,
}: {
  trip: Trip;
  day: TripDay;
  dayIndex: number;
  month: number;
  attractionById: Map<string, Attraction>;
  stations: StationForecast[] | null;
}) {
  const { addDay, removeDay, setDayNote } = useTrip();
  const date = dateForDay(trip, dayIndex);
  const dayMonth = date ? date.getMonth() : month;

  // Per-leg drive estimates between consecutive coordinate stops.
  const coordStops = day.stops.filter((s) => s.lat !== null && s.lng !== null) as (TripStop & { lat: number; lng: number })[];
  let totalDrive = 0;
  const legs: string[] = [];
  for (let i = 1; i < coordStops.length; i++) {
    const est = driveEstimate(coordStops[i - 1].lat, coordStops[i - 1].lng, coordStops[i].lat, coordStops[i].lng, dayMonth);
    totalDrive += est.minutes;
    legs.push(est.label);
  }
  const totalVisit = day.stops.reduce((acc, s) => acc + (s.durationMin ?? 45), 0);

  // Daylight for THIS date at the day's first stop.
  const anchor = coordStops[0] ?? { lat: REYKJAVIK.lat, lng: REYKJAVIK.lng };
  const dl = date ? daylightFor(date, anchor.lat, anchor.lng) : null;
  const overBudget =
    dl?.dayLengthMin != null && (dayMonth >= 9 || dayMonth <= 2) && totalDrive + totalVisit > dl.dayLengthMin;

  // Nearest station wind line (first forecast hour) when we have live weather.
  let weatherLine: string | null = null;
  if (stations && coordStops.length > 0) {
    let best: StationForecast | null = null;
    let bestD = Infinity;
    for (const s of stations) {
      const d = (s.lat - anchor.lat) ** 2 + (s.lng - anchor.lng) ** 2;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    const h = best?.forecast[0];
    if (best && h) {
      weatherLine = `${best.name}: ${h.windMs ?? "–"} m/s ${h.windDir ?? ""}, ${h.tempC ?? "–"}°C${h.desc ? `, ${h.desc}` : ""}`;
    }
  }

  const gmapsDay = dayRouteUrl(coordStops.map((s) => ({ lat: s.lat, lng: s.lng })));

  return (
    <div className="print-card rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-strong">
            Day {dayIndex + 1}
            {date && <span className="ml-2 font-normal text-muted">{formatTripDate(date)}</span>}
          </h3>
          <input
            value={day.note}
            onChange={(e) => setDayNote(trip.id, dayIndex, e.target.value)}
            placeholder="Theme for the day (e.g. South coast)…"
            className="mt-1 w-56 max-w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-muted focus:border-border focus:bg-canvas"
          />
        </div>
        <div className="no-print flex items-center gap-1.5">
          {gmapsDay && (
            <a
              href={gmapsDay.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-ice/40 bg-ice/10 px-2.5 py-1 text-xs font-medium text-ice hover:bg-ice/20"
            >
              Drive it in Google Maps ↗{gmapsDay.included < gmapsDay.total ? ` (${gmapsDay.included} of ${gmapsDay.total} stops — Google's limit)` : ""}
            </a>
          )}
          {trip.days.length > 1 && (
            <button
              onClick={() => removeDay(trip.id, dayIndex)}
              className="rounded-lg border border-border px-2 py-1 text-xs text-muted hover:text-danger"
            >
              Remove day
            </button>
          )}
        </div>
      </div>

      {/* summary strip */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        {coordStops.length >= 2 && (
          <span className="inline-flex items-center gap-1">
            <CarIcon size={13} /> ~{formatDriveMinutes(totalDrive)} driving
          </span>
        )}
        {day.stops.length > 0 && <span>~{formatDriveMinutes(totalVisit)} at stops</span>}
        {date && dl && (
          <DaylightCard compact date={date} lat={anchor.lat} lng={anchor.lng} />
        )}
        {weatherLine && <span>{weatherLine}</span>}
      </div>
      {overBudget && dl?.dayLengthMin != null && (
        <p className="mt-1.5 text-xs font-medium text-warn">
          ⚠ Planned driving + visits (~{formatDriveMinutes(totalDrive + totalVisit)}) exceed the {dl.dayLengthLabel}{" "}
          of daylight — you&apos;ll be driving in the dark for ~
          {formatDriveMinutes(totalDrive + totalVisit - dl.dayLengthMin)}.
        </p>
      )}

      {/* stops */}
      {day.stops.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted">
          No stops yet — add places from the Map, Tours or Routes pages.
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {day.stops.map((s, i) => (
            <div key={s.id}>
              {i > 0 && legs[i - 1] && (
                <p className="ml-8 py-0.5 text-[11px] text-muted">↓ {legs[i - 1]} <span className="opacity-70">(straight-line estimate)</span></p>
              )}
              <TripStopRow
                trip={trip}
                dayIndex={dayIndex}
                stop={s}
                stopIndex={i}
                month={dayMonth}
                attractionById={attractionById}
              />
            </div>
          ))}
        </ul>
      )}

      {dayIndex === trip.days.length - 1 && (
        <button
          onClick={() => addDay(trip.id)}
          className="no-print mt-3 w-full rounded-lg border border-dashed border-border py-2 text-sm text-muted hover:border-aurora/50 hover:text-aurora"
        >
          + Add day {trip.days.length + 1}
        </button>
      )}
    </div>
  );
}

"use client";

// The itinerary builder: named trips, dated day-by-day plan with drive/daylight
// summaries and seasonal warnings, JSON export/import, print.

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { PrintIcon } from "@/components/icons";
import { TripDayCard, TripPicker } from "@/components/planner";
import { PresetTrips } from "@/components/PresetTrips";
import { EmptyState } from "@/components/ui";
import { getAttractions } from "@/lib/api";
import { getWeather } from "@/lib/live";
import { MONTH_NAMES } from "@/lib/season";
import { useSeason } from "@/lib/season-context";
import { useTrip } from "@/lib/trip";
import type { Attraction, WeatherFile } from "@/lib/types";

export default function PlanPage() {
  const { month } = useSeason();
  const { activeTrip, ready, setStartDate, exportTrips, importTrips } = useTrip();
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [weather, setWeather] = useState<WeatherFile | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getAttractions().then((f) => setAttractions(f.attractions));
    getWeather().then(setWeather);
  }, []);

  const attractionById = useMemo(() => new Map(attractions.map((a) => [a.id, a])), [attractions]);

  const doExport = () => {
    const blob = new Blob([exportTrips()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "icelandplanner-trips.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const doImport = (file: File) => {
    file.text().then((txt) => {
      const res = importTrips(txt);
      setImportMsg(res.error ?? `Imported ${res.added} trip${res.added === 1 ? "" : "s"}.`);
      setTimeout(() => setImportMsg(null), 4000);
    });
  };

  if (!ready) return <p className="text-sm text-muted">Loading…</p>;

  const stopCount = activeTrip?.days.reduce((acc, d) => acc + d.stops.length, 0) ?? 0;

  return (
    <div>
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-strong">Trip planner</h1>
          <p className="mt-1 text-sm text-muted">
            Day by day, with honest drive estimates, the daylight you&apos;ll actually have, and warnings when a
            stop doesn&apos;t fit your season. Everything stays on this device.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={doExport} className="rounded-lg border border-border px-2.5 py-1.5 text-sm text-muted hover:bg-surface">
            Export JSON
          </button>
          <button onClick={() => fileRef.current?.click()} className="rounded-lg border border-border px-2.5 py-1.5 text-sm text-muted hover:bg-surface">
            Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) doImport(f);
              e.target.value = "";
            }}
          />
          <button onClick={() => window.print()} className="rounded-lg border border-border px-2.5 py-1.5 text-sm text-muted hover:bg-surface" aria-label="Print itinerary">
            <PrintIcon size={15} />
          </button>
        </div>
      </div>
      {importMsg && <p className="no-print mt-2 rounded-lg bg-surface px-3 py-1.5 text-sm text-aurora">{importMsg}</p>}

      <div className="no-print mt-4">
        <TripPicker />
      </div>

      <PresetTrips />

      {!activeTrip ? (
        <div className="mt-6">
          <EmptyState>
            No trips yet. Start from a trip idea above, hit <span className="font-medium text-fg">+ New trip</span>,
            or just add any place from the <Link href="/map" className="text-aurora hover:underline">map</Link>,{" "}
            <Link href="/tours" className="text-aurora hover:underline">tours</Link> or{" "}
            <Link href="/routes" className="text-aurora hover:underline">routes</Link> — a trip appears automatically.
          </EmptyState>
        </div>
      ) : (
        <>
          {/* trip header: name for print, date control */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-strong">
              {activeTrip.name}
              <span className="ml-2 text-sm font-normal text-muted">
                {activeTrip.days.length} day{activeTrip.days.length > 1 ? "s" : ""} · {stopCount} stop{stopCount === 1 ? "" : "s"}
              </span>
            </h2>
            <label className="no-print flex items-center gap-2 text-sm text-muted">
              Starts
              <input
                type="date"
                value={activeTrip.startDate ?? ""}
                onChange={(e) => setStartDate(activeTrip.id, e.target.value || null)}
                className="rounded-lg border border-border bg-surface px-2 py-1 text-sm text-fg"
              />
            </label>
          </div>
          {!activeTrip.startDate && (
            <p className="no-print mt-1.5 text-xs text-muted">
              Set a start date to unlock per-day daylight windows and dark-driving warnings. Planning for{" "}
              <span className="font-medium text-fg">{MONTH_NAMES[month]}</span> meanwhile (change it in the top bar).
            </p>
          )}

          <div className="mt-4 space-y-4">
            {activeTrip.days.map((day, i) => (
              <TripDayCard
                key={day.id}
                trip={activeTrip}
                day={day}
                dayIndex={i}
                month={month}
                attractionById={attractionById}
                stations={weather?.stations ?? null}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

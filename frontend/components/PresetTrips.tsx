"use client";

// "Trip ideas" — preset itineraries assembled from curated day blocks.
// Pick a season × length × discovery level, preview the day-by-day plan,
// one tap creates it as a real (editable) trip.

import { useEffect, useMemo, useState } from "react";

import { CheckIcon, PlusIcon } from "@/components/icons";
import { getAttractions, getDayBlocks } from "@/lib/api";
import { driveEstimate, formatDriveMinutes } from "@/lib/geo";
import {
  buildPreset, LEVELS, SEASONS, seasonForMonth, TRIP_LENGTHS,
  type DiscoveryLevel, type SeasonKey,
} from "@/lib/presets";
import { useSeason } from "@/lib/season-context";
import { useTrip } from "@/lib/trip";
import type { Attraction, DayBlock } from "@/lib/types";

const chip = (active: boolean, extra = "") =>
  `shrink-0 rounded-full border px-3 py-1 text-sm transition-colors ${extra} ${
    active
      ? "border-aurora/50 bg-aurora/15 font-medium text-strong"
      : "border-border bg-canvas text-muted hover:bg-surface-2 hover:text-fg"
  }`;

export function PresetTrips() {
  const { month } = useSeason();
  const { createTripFromDays } = useTrip();
  const [blocks, setBlocks] = useState<DayBlock[]>([]);
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [season, setSeason] = useState<SeasonKey | null>(null); // null until ready → derive from travel month
  const [days, setDays] = useState<number>(7);
  const [level, setLevel] = useState<DiscoveryLevel>(1);
  const [created, setCreated] = useState(false);

  useEffect(() => {
    getDayBlocks().then((f) => setBlocks(f.blocks));
    getAttractions().then((f) => setAttractions(f.attractions));
  }, []);

  const activeSeason = season ?? seasonForMonth(month);
  const seasonDef = SEASONS.find((s) => s.key === activeSeason) ?? SEASONS[2];

  const preset = useMemo(
    () => (blocks.length > 0 && attractions.length > 0 ? buildPreset(blocks, attractions, seasonDef.month, days, level) : null),
    [blocks, attractions, seasonDef.month, days, level],
  );

  // Rough per-day + total drive between consecutive stops (straight-line × road factor).
  const driveByDay = useMemo(() => {
    if (!preset) return [];
    return preset.days.map((d) => {
      let min = 0;
      for (let i = 1; i < d.seeds.length; i++) {
        const a = d.seeds[i - 1];
        const b = d.seeds[i];
        if (a.lat !== null && a.lng !== null && b.lat !== null && b.lng !== null) {
          min += driveEstimate(a.lat, a.lng, b.lat, b.lng, seasonDef.month).minutes;
        }
      }
      return min;
    });
  }, [preset, seasonDef.month]);
  const totalDrive = driveByDay.reduce((a, b) => a + b, 0);

  const start = () => {
    if (!preset || preset.days.length === 0 || created) return;
    const levelDef = LEVELS.find((l) => l.value === level)!;
    createTripFromDays(
      `${seasonDef.label} ${levelDef.label.toLowerCase()} · ${preset.days.length} days`,
      preset.days.map((d) => ({ note: d.block.title, seeds: d.seeds })),
    );
    setCreated(true);
    setTimeout(() => setCreated(false), 3000);
  };

  if (blocks.length === 0) return null; // data not built yet — section simply absent

  return (
    <section className="no-print mt-6 rounded-2xl border border-border bg-surface p-4 md:p-5">
      <h2 className="text-lg font-semibold text-strong">Trip ideas</h2>
      <p className="mt-0.5 text-sm text-muted">
        A ready-made itinerary tuned to Iceland&apos;s seasons — start from one, then reshape it below.
      </p>

      {/* season */}
      <div className="mt-3 flex flex-wrap gap-2">
        {SEASONS.map((s) => (
          <button key={s.key} className={chip(activeSeason === s.key)} onClick={() => setSeason(s.key)} title={s.blurb}>
            {s.label}
          </button>
        ))}
      </div>
      <p className="mt-1 text-xs text-muted">{seasonDef.blurb}</p>

      {/* length + level */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">Days</span>
          {TRIP_LENGTHS.map((n) => (
            <button key={n} className={chip(days === n)} onClick={() => setDays(n)}>
              {n}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">Discovery</span>
          {LEVELS.map((l) => (
            <button key={l.value} className={chip(level === l.value)} onClick={() => setLevel(l.value)} title={l.blurb}>
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* preview */}
      {preset && preset.days.length > 0 ? (
        <>
          <ol className="mt-4 space-y-1">
            {preset.days.map((d, i) => (
              <li key={d.block.id} className="flex items-baseline gap-2 text-sm">
                <span className="w-12 shrink-0 text-xs font-semibold uppercase text-muted">Day {i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-strong">{d.block.title}</span>
                  <span className="text-muted">
                    {" "}· {d.seeds.length} stop{d.seeds.length === 1 ? "" : "s"}
                    {driveByDay[i] > 20 ? ` · ~${formatDriveMinutes(driveByDay[i])} drive` : ""}
                  </span>
                  {d.seasonScore === 1 && (
                    <span className="ml-1.5 rounded-full bg-warn/15 px-1.5 py-0.5 text-[10px] font-medium text-warn ring-1 ring-warn/40">
                      shoulder — check conditions
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-muted">
            {preset.ringDays >= 3
              ? "Full ring-road circuit."
              : preset.ringDays >= 1
                ? "Mostly Reykjavík-based with far-flung days — expect long transfers."
                : "Reykjavík-based — no long one-way legs."}
            {totalDrive > 0 && <> ~{formatDriveMinutes(totalDrive)} between stops overall (plus transfers), straight-line estimates.</>}
            {preset.short && <> Only {preset.days.length} in-season days exist for this combination.</>}
          </p>
          <button
            onClick={start}
            className={`mt-3 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold ${
              created ? "bg-aurora/15 text-aurora" : "bg-aurora text-black hover:bg-aurora-dim"
            }`}
          >
            {created ? (
              <>
                <CheckIcon size={14} /> Created — it&apos;s your active trip below
              </>
            ) : (
              <>
                <PlusIcon size={14} /> Start this trip
              </>
            )}
          </button>
        </>
      ) : (
        <p className="mt-4 text-sm text-muted">Nothing fits that combination — try another season or level.</p>
      )}
    </section>
  );
}

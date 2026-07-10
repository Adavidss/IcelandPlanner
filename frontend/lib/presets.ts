// Preset-trip generator: assembles hand-authored day blocks (day-blocks.json)
// into a coherent itinerary for a (season, trip length, discovery level)
// combination. Deterministic — same inputs, same trip.
//
// How it chooses:
//   1. Score every block: seasonScore(month) × 3 + level affinity.
//   2. Trips ≤ 6 days stay Reykjavík-based (zone "sw"); 7+ days go full ring
//      when enough ring blocks are in season — otherwise sw with more depth.
//   3. Take the top-N blocks by score, then sort by `order` for geographic flow.
//   4. Repeated attractions across chosen blocks are dropped once used.

import { scoreAt } from "./season";
import type { Attraction, DayBlock, TripStopSeed } from "./types";

export type SeasonKey = "winter" | "spring" | "summer" | "autumn";

export const SEASONS: { key: SeasonKey; label: string; month: number; blurb: string }[] = [
  { key: "winter", label: "Winter", month: 1, blurb: "Aurora, ice and 5–7 h days — small loops, big skies" },
  { key: "spring", label: "Spring", month: 4, blurb: "Long days, first puffins, few crowds" },
  { key: "summer", label: "Summer", month: 6, blurb: "Midnight sun — the whole country is open" },
  { key: "autumn", label: "Autumn", month: 8, blurb: "Golden colors and the aurora's return" },
];

export function seasonForMonth(m: number): SeasonKey {
  if (m >= 10 || m <= 2) return "winter"; // Nov–Mar
  if (m <= 4) return "spring"; // Apr–May
  if (m <= 7) return "summer"; // Jun–Aug
  return "autumn"; // Sep–Oct
}

export type DiscoveryLevel = 1 | 2 | 3;

export const LEVELS: { value: DiscoveryLevel; label: string; blurb: string }[] = [
  { value: 1, label: "Greatest hits", blurb: "The icons — first trip, maximum wow" },
  { value: 2, label: "Explorer", blurb: "Classics plus the quieter layer behind them" },
  { value: 3, label: "Off the beaten path", blurb: "Highlands, Westfjords, places without buses" },
];

// affinity[level of block − 1] added per discovery choice
const AFFINITY: Record<DiscoveryLevel, [number, number, number]> = {
  1: [4, 0, -6],
  2: [1, 4, 1],
  3: [-2, 2, 5],
};

export const TRIP_LENGTHS = [3, 5, 7, 10];

export interface PresetDay {
  block: DayBlock;
  seasonScore: number;
  /** Stops resolved against attractions, minus ones already used earlier in the trip. */
  seeds: TripStopSeed[];
}

export interface Preset {
  days: PresetDay[];
  /** How many chosen days need the full circle — drives the shape note. */
  ringDays: number;
  /** True when fewer in-season blocks exist than requested days. */
  short: boolean;
}

export function buildPreset(
  blocks: DayBlock[],
  attractions: Attraction[],
  month: number,
  days: number,
  level: DiscoveryLevel,
): Preset {
  const byId = new Map(attractions.map((a) => [a.id, a]));

  const scored = blocks
    .map((b) => ({ b, season: scoreAt(b.months, month) }))
    .filter((x) => x.season >= 1)
    .map((x) => ({ ...x, score: x.season * 3 + AFFINITY[level][x.b.level - 1] }))
    .filter((x) => x.score > 0);

  const ringOpen = scored.filter((x) => x.b.zone === "ring" && x.season >= 2).length >= 5;
  const ring = days >= 7 && ringOpen;
  const pool = ring ? scored : scored.filter((x) => x.b.zone === "sw");

  const chosen = [...pool]
    .sort((a, z) => z.score - a.score || a.b.order - z.b.order)
    .slice(0, days)
    .sort((a, z) => a.b.order - z.b.order);

  // Resolve stops, dropping attractions already used by an earlier day.
  const used = new Set<string>();
  const presetDays: PresetDay[] = chosen.map(({ b, season }) => {
    const seeds: TripStopSeed[] = [];
    for (const id of b.stops) {
      if (used.has(id)) continue;
      const a = byId.get(id);
      if (!a) continue;
      used.add(id);
      seeds.push({
        kind: "attraction",
        refId: a.id,
        name: a.name,
        lat: a.lat,
        lng: a.lng,
        durationMin: a.durationMin,
      });
    }
    return { block: b, seasonScore: season, seeds };
  });

  return {
    days: presetDays.filter((d) => d.seeds.length > 0),
    ringDays: chosen.filter((x) => x.b.zone === "ring").length,
    short: chosen.length < days,
  };
}

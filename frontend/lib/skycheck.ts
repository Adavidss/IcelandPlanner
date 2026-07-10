// Helpers for the map's aurora + weather views: pick tonight's forecast hour,
// grade the sky for aurora watching from vedur's text descriptions, and turn
// compass strings into degrees. Vedur times are zone-less Iceland-local
// strings — and Iceland runs UTC year-round, so they compare against UTC now.

import type { ForecastHour, StationForecast } from "./types";

const T_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/;

/** Zone-less "2026-07-10 23:00:00" (or ISO-T) → epoch ms treated as UTC. */
export function parseIcelandTime(s: string): number | null {
  const m = T_RE.exec(s);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
}

/** The forecast hour to judge tonight by: the next 21:00–02:00 slot. */
export function pickTonightHour(station: StationForecast): ForecastHour | null {
  const now = Date.now() - 30 * 60_000; // allow the current slot
  let best: { h: ForecastHour; t: number } | null = null;
  for (const h of station.forecast) {
    const t = parseIcelandTime(h.time);
    if (t === null || t < now) continue;
    const hour = new Date(t).getUTCHours();
    if (hour >= 21 || hour <= 2) {
      if (!best || t < best.t) best = { h, t };
    }
  }
  return best?.h ?? null;
}

export type SkyQuality = "clear" | "mixed" | "covered";

export const SKY_META: Record<SkyQuality, { color: string; label: string }> = {
  clear: { color: "#34d399", label: "Clear-ish — good aurora sky" },
  mixed: { color: "#f59e0b", label: "Partly cloudy — gaps possible" },
  covered: { color: "#6b7280", label: "Overcast / precipitation" },
};

/** Grade a vedur weather description for aurora-watching purposes. */
export function skyQuality(desc: string | null | undefined): SkyQuality {
  if (!desc) return "mixed";
  const d = desc.toLowerCase();
  if (/clear|fair|sunny/.test(d)) return "clear";
  if (/partly|light cloud/.test(d)) return "mixed";
  if (/cloud|overcast|rain|sleet|snow|drizzle|fog|mist|shower|thunder/.test(d)) return "covered";
  return "mixed";
}

const COMPASS: Record<string, number> = {
  N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
  S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
};

/** Compass string → degrees the wind comes FROM (null when unknown). */
export function windFromDeg(dir: string | null | undefined): number | null {
  if (!dir) return null;
  return COMPASS[dir.trim().toUpperCase()] ?? null;
}

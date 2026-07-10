// Live-ish + client-direct data.
//
//  - Tier-2 files (roads/weather/hazards/status) come from the repo's orphan
//    `data` branch via raw.githubusercontent.com (ACAO *, ~5 min CDN, refreshed
//    every ~30 min by live-data.yml). NOT module-cached — callers re-poll.
//  - Client-direct: NOAA Kp (aurora) and SafeTravel alerts (CORS-open).
// Every fetcher fails to null; the UI hides or degrades, never crashes.

import type { HazardsFile, LiveStatus, RoadsFile, WeatherFile } from "./types";

const LIVE_BASE = process.env.NEXT_PUBLIC_LIVE_DATA_BASE ?? "";

async function getLive<T>(file: string): Promise<T | null> {
  if (!LIVE_BASE) return null;
  try {
    const r = await fetch(`${LIVE_BASE}/${file}`, { cache: "no-cache" });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export const getRoads = () => getLive<RoadsFile>("roads.json");
export const getWeather = () => getLive<WeatherFile>("weather.json");
export const getHazards = () => getLive<HazardsFile>("hazards.json");
export const getLiveStatus = () => getLive<LiveStatus>("status.json");

export type Freshness = "fresh" | "stale" | "unavailable";

/** Stale = pipeline hasn't run in 3× its interval; unavailable = no status at all. */
export function liveFreshness(status: LiveStatus | null): Freshness {
  if (!status?.run_at) return "unavailable";
  const t = Date.parse(status.run_at);
  if (Number.isNaN(t)) return "unavailable";
  return Date.now() - t > 90 * 60_000 ? "stale" : "fresh";
}

// ---- NOAA planetary K-index (aurora strength) ------------------------------

export interface KpNow {
  kp: number;
  time: string;
}

export interface KpPoint {
  /** Zone-less UTC "2026-07-10T21:00:00" (Iceland local == UTC year-round). */
  time: string;
  kp: number;
  kind: "observed" | "estimated" | "predicted";
}

/** NOAA 3-day Kp forecast (3-hour steps, ~last week observed + 3 days ahead). */
export async function fetchKpForecast(): Promise<KpPoint[] | null> {
  try {
    const r = await fetch("https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json", {
      cache: "no-cache",
    });
    if (!r.ok) return null;
    const raw = (await r.json()) as unknown[];
    if (!Array.isArray(raw)) return null;
    const points: KpPoint[] = [];
    for (const row of raw) {
      // Object rows {time_tag, kp, observed} (current shape) or legacy array rows.
      const o = row as { time_tag?: string; kp?: unknown; observed?: string };
      const time = o.time_tag ?? (Array.isArray(row) ? String(row[0]) : null);
      const kp = Number(o.kp ?? (Array.isArray(row) ? row[1] : NaN));
      const kindRaw = o.observed ?? (Array.isArray(row) ? String(row[2]) : "");
      if (!time || time === "time_tag" || !Number.isFinite(kp)) continue;
      const kind = kindRaw === "observed" || kindRaw === "estimated" ? kindRaw : "predicted";
      points.push({ time, kp, kind });
    }
    return points.length > 0 ? points.sort((a, b) => a.time.localeCompare(b.time)) : null;
  } catch {
    return null;
  }
}

/** Latest planetary Kp. Handles both SWPC shapes: object rows
 *  {time_tag, Kp, …} (current) and legacy [time_tag, Kp, …] arrays. */
export async function fetchKp(): Promise<KpNow | null> {
  try {
    const r = await fetch("https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json", {
      cache: "no-cache",
    });
    if (!r.ok) return null;
    const rows = (await r.json()) as unknown[];
    if (!Array.isArray(rows) || rows.length === 0) return null;
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i] as { time_tag?: string; Kp?: unknown; kp?: unknown };
      const time = row.time_tag ?? (Array.isArray(rows[i]) ? String((rows[i] as unknown[])[0]) : null);
      const kp = Number(row.Kp ?? row.kp ?? (Array.isArray(rows[i]) ? (rows[i] as unknown[])[1] : NaN));
      if (time && time !== "time_tag" && Number.isFinite(kp)) return { kp, time };
    }
    return null;
  } catch {
    return null;
  }
}

// ---- SafeTravel alerts (WordPress REST, CORS-open) ---------------------------

export interface TravelAlert {
  id: number;
  title: string;
  body: string;
  link: string | null;
  date: string | null;
}

/** Remote HTML is untrusted — strip every tag to text, never render as HTML. */
function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchAlerts(): Promise<TravelAlert[] | null> {
  try {
    const r = await fetch("https://safetravel.is/wp-json/wp/v2/alert?per_page=100", { cache: "no-cache" });
    if (!r.ok) return null;
    const raw = (await r.json()) as Record<string, unknown>[];
    if (!Array.isArray(raw)) return null;
    return raw.map((a) => {
      const title = (a.title as { rendered?: string })?.rendered ?? "";
      const content = (a.content as { rendered?: string })?.rendered ?? "";
      return {
        id: Number(a.id ?? 0),
        title: stripHtml(String(title)),
        body: stripHtml(String(content)).slice(0, 400),
        link: typeof a.link === "string" ? a.link : null,
        date: typeof a.date === "string" ? a.date : null,
      };
    }).filter((a) => a.title);
  } catch {
    return null;
  }
}

// ---- Curated external links ---------------------------------------------------

export const EXTERNAL = {
  roads: "https://umferdin.is/en",
  safetravel: "https://safetravel.is",
  weather: "https://en.vedur.is",
  aurora: "https://en.vedur.is/weather/forecasts/aurora/",
  alerts112: "https://www.112.is/en",
  webcams: [
    { name: "Road webcams (Vegagerðin)", url: "https://www.road.is/travel-info/web-cams/" },
    { name: "Hellisheiði pass cam", url: "https://www.road.is/travel-info/web-cams/#Sudurland" },
    { name: "Live from Iceland (city & nature cams)", url: "https://www.livefromiceland.is/" },
  ],
} as const;

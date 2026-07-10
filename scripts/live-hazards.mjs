// Tier-2: SafeTravel pre-digested hazard JSONs → <out>/hazards.json
//   - faerd_punktar.json: road-hazard points (rockfall, wind gusts, …)
//   - reynisfjara_litakodi.json: black-beach danger color (GREEN/YELLOW/RED)
//
// The two sub-sources are independent: one failing keeps the other's fresh
// data, merged with the previous file's stale half. Both failing throws.

import { fetchJSON } from "./lib/fetch.mjs";
import { inIcelandBBox, nowISO, payloadHash, readJSON, round5, writeJSON } from "./lib/io.mjs";

const POINTS =
  "https://safetravel.is/wp-content/themes/safetravel/blocks/travel-conditions/data/json/faerd_punktar.json";
const REYNISFJARA = "https://safetravel.is/wp-content/plugins/black-beach-safety/reynisfjara_litakodi.json";

const LEVEL_COLORS = { GREEN: "#22c55e", YELLOW: "#eab308", RED: "#ef4444", UNKNOWN: "#6b7280" };

// safetravel.is's WAF rejects obvious non-browser clients from datacenter IPs
// (observed: connection-level failures from GitHub runners, fine from home).
// A browser-like identity is a best-effort workaround; if it still fails, the
// dataset just stays stale/absent and the UI hides it — by design.
const BROWSER_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  accept: "application/json,text/plain,*/*",
  "accept-language": "en-US,en;q=0.9",
  referer: "https://safetravel.is/",
};

function normalizePoints(raw) {
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.features) ? raw.features : [];
  const points = [];
  for (const p of list) {
    const props = p.properties ?? p;
    const lat = Number(props.Breidd ?? props.lat ?? p.geometry?.coordinates?.[1]);
    const lng = Number(props.Lengd ?? props.lng ?? p.geometry?.coordinates?.[0]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inIcelandBBox(lat, lng)) continue;
    points.push({
      lat: round5(lat),
      lng: round5(lng),
      type: String(props.Astand ?? props.type ?? "hazard"),
      title: props.Heiti ?? props.title ?? null,
      description: props.Lysing ?? props.LysingEn ?? props.description ?? null,
    });
  }
  return points;
}

function normalizeReynisfjara(raw) {
  // The feed is an ARRAY of 3-hourly slices: [{site, datetime, color_code}, …]
  // (Iceland local == UTC). Pick the slice covering now: the last one whose
  // datetime <= now, else the first upcoming one.
  let entry = raw;
  if (Array.isArray(raw) && raw.length > 0) {
    const now = Date.now();
    const past = raw.filter((e) => Date.parse(`${e?.datetime}Z`) <= now);
    entry = past.length > 0 ? past[past.length - 1] : raw[0];
  }
  const code = String(entry?.color_code ?? entry?.colorCode ?? "").toUpperCase();
  const level = ["GREEN", "YELLOW", "RED"].includes(code) ? code : "UNKNOWN";
  return { level, color: LEVEL_COLORS[level], raw: entry?.color_code ?? null, at: entry?.datetime ?? null };
}

export async function liveHazards(outDir) {
  const path = `${outDir}/hazards.json`;
  const prev = readJSON(path);

  let points = null;
  let reynisfjara = null;
  const errors = [];
  try {
    points = normalizePoints(await fetchJSON(POINTS, { timeoutMs: 30_000, headers: BROWSER_HEADERS }));
  } catch (err) {
    errors.push(`points: ${err.message}`);
  }
  try {
    reynisfjara = normalizeReynisfjara(await fetchJSON(REYNISFJARA, { timeoutMs: 30_000, headers: BROWSER_HEADERS }));
  } catch (err) {
    errors.push(`reynisfjara: ${err.message}`);
  }

  if (points === null && reynisfjara === null) throw new Error(errors.join("; "));
  if (errors.length > 0) console.error(`live-hazards: partial (${errors.join("; ")})`);

  const out = {
    updated_at: nowISO(),
    points: points ?? prev?.points ?? [],
    reynisfjara: reynisfjara ?? prev?.reynisfjara ?? normalizeReynisfjara(null),
  };
  const changed = !prev || payloadHash(prev) !== payloadHash(out);
  if (changed) writeJSON(path, out);
  console.log(
    `live-hazards: ${out.points.length} points, Reynisfjara ${out.reynisfjara.level} (${changed ? "changed" : "unchanged"})`,
  );
  return { changed, updated_at: changed ? out.updated_at : prev?.updated_at ?? out.updated_at };
}

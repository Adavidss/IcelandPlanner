// ONE-OFF developer tool (not part of any workflow): harvest static road
// segment geometry from SafeTravel's pre-digested icelandic_roads_calc.json
// (701 segments whose ids match Vegagerðin faerd2017_1 IdButur), simplify,
// and commit as data/curated/road-geometry.json.
//
// Geometry changes ~never; conditions change every 30 min — so geometry ships
// tier-1 and the live file joins on `id`. Re-run only if Vegagerðin re-cuts
// their segments (live-roads will then log ids missing geometry).
//
//   node scripts/dev/make-road-geometry.mjs

import { fetchJSON } from "../lib/fetch.mjs";
import { nowISO, round5, thinLine, writeJSON } from "../lib/io.mjs";

const SOURCE =
  "https://safetravel.is/wp-content/themes/safetravel/blocks/travel-conditions/data/json/icelandic_roads_calc.json";
const OUT = "data/curated/road-geometry.json";
const MIN_KM = 0.35; // thin points closer than this — plenty at country zoom

const raw = await fetchJSON(SOURCE, { timeoutMs: 60_000 });
if (!Array.isArray(raw) || raw.length < 100) {
  console.error(`unexpected payload (${Array.isArray(raw) ? raw.length : typeof raw})`);
  process.exit(1);
}

let pointsIn = 0;
let pointsOut = 0;
const segments = raw
  .map((s) => {
    const parts = (s.coordinates ?? [])
      .map((part) => {
        const pts = part
          .map((p) => [round5(p.lat), round5(p.lng)])
          .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
        pointsIn += pts.length;
        const thin = thinLine(pts, MIN_KM);
        pointsOut += thin.length;
        return thin;
      })
      .filter((part) => part.length >= 2);
    return { id: Number(s.id), road: s.vegnr ?? null, name: s.stutt_nafn_leidar ?? "", parts };
  })
  .filter((s) => Number.isFinite(s.id) && s.parts.length > 0)
  .sort((a, b) => a.id - b.id);

writeJSON(OUT, { generated_at: nowISO(), source: SOURCE, count: segments.length, segments });
console.log(`make-road-geometry: ${segments.length} segments, ${pointsIn} → ${pointsOut} points → ${OUT}`);

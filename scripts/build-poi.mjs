// POIs from OpenStreetMap Overpass → poi-{food,fuel,pools,shops,stay}.json
//
// Two modes:
//   --fetch   query Overpass (weekly-data.yml + manual) → frontend/public/data/
//   default   copy the committed data/cache/poi-*.json → frontend/public/data/
//             (what every deploy does — deploys never hit Overpass)

import { inIcelandBBox, nowISO, readJSON, round5, writeJSON } from "./lib/io.mjs";

const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const QUERY = `[out:json][timeout:180];
area["ISO3166-1"="IS"][admin_level=2]->.is;
(
  nwr["amenity"~"^(restaurant|cafe|fast_food|fuel|bar|pub)$"](area.is);
  nwr["shop"~"^(supermarket|convenience)$"](area.is);
  nwr["leisure"="swimming_pool"](area.is);
  nwr["tourism"~"^(hotel|guest_house|hostel|motel|camp_site|apartment|chalet)$"](area.is);
);
out center tags;`;

export const POI_FILES = ["poi-food.json", "poi-fuel.json", "poi-pools.json", "poi-shops.json", "poi-stay.json"];
const OUT_DIR = "frontend/public/data";
const CACHE_DIR = "data/cache";
const UA = "IcelandPlanner/1.0 (+https://github.com/Adavidss/IcelandPlanner)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function classify(tags) {
  const a = tags.amenity, s = tags.shop, t = tags.tourism;
  if (a === "fuel") return { kind: "fuel", subkind: "fuel", file: "poi-fuel.json" };
  if (a) return { kind: "food", subkind: a, file: "poi-food.json" };
  if (s) return { kind: "grocery", subkind: s, file: "poi-shops.json" };
  if (t) return { kind: "stay", subkind: t, file: "poi-stay.json" };
  if (tags.leisure === "swimming_pool") return { kind: "pool", subkind: "swimming_pool", file: "poi-pools.json" };
  return null;
}

/** OSM tags are community-editable — treat URLs as untrusted. Normalize
 *  schemaless domains to https://, reject any other scheme (javascript:, …). */
function safeUrl(v) {
  if (!v || typeof v !== "string") return null;
  const s = v.trim().split(/[\s;]+/)[0]; // some tags hold multiple URLs
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(\/\S*)?$/i.test(s)) return `https://${s}`;
  return null;
}

function slim(el) {
  const tags = el.tags ?? {};
  const cls = classify(tags);
  if (!cls) return null;
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null || !inIcelandBBox(lat, lng)) return null;
  const name = tags.name ?? tags["name:en"] ?? tags.brand ?? null;
  if (!name) return null; // unnamed (private garden pools, untagged sheds) — skip
  return {
    file: cls.file,
    poi: {
      id: `${el.type[0]}${el.id}`,
      name,
      kind: cls.kind,
      subkind: cls.subkind,
      lat: round5(lat),
      lng: round5(lng),
      cuisine: tags.cuisine ?? null,
      hours: tags.opening_hours ?? null,
      website: safeUrl(tags.website ?? tags["contact:website"]),
      phone: tags.phone ?? tags["contact:phone"] ?? null,
      brand: tags.brand ?? null,
      town: tags["addr:city"] ?? null,
    },
  };
}

async function fetchOverpass() {
  const backoffs = [5_000, 20_000, 60_000];
  let lastErr;
  for (const mirror of MIRRORS) {
    for (let attempt = 0; attempt < backoffs.length; attempt++) {
      try {
        const res = await fetch(mirror, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": UA },
          body: `data=${encodeURIComponent(QUERY)}`,
          signal: AbortSignal.timeout(200_000),
        });
        if (res.status === 429 || res.status >= 500) {
          lastErr = new Error(`${mirror} → ${res.status}`);
          const retryAfter = Number(res.headers.get("retry-after")) * 1000;
          await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : backoffs[attempt]);
          continue;
        }
        if (!res.ok) throw new Error(`${mirror} → ${res.status}`);
        return await res.json();
      } catch (err) {
        lastErr = err;
        console.error(`build-poi: attempt failed (${err.message})`);
        await sleep(backoffs[attempt]);
      }
    }
    console.error(`build-poi: giving up on ${mirror}, trying next mirror`);
  }
  throw lastErr ?? new Error("all Overpass mirrors failed");
}

function copyCache() {
  let total = 0;
  let newest = "";
  let missing = 0;
  for (const f of POI_FILES) {
    const obj = readJSON(`${CACHE_DIR}/${f}`) ?? { generated_at: "", source: "overpass", count: 0, poi: [] };
    if (!obj.poi?.length) missing++;
    writeJSON(`${OUT_DIR}/${f}`, obj);
    total += obj.poi?.length ?? 0;
    if ((obj.generated_at ?? "") > newest) newest = obj.generated_at;
  }
  console.log(`build-poi: copied cache (${total} POIs${missing ? `, ${missing} files empty` : ""})`);
  return { status: total === 0 ? "empty" : "cache", count: total, generated_at: newest };
}

export async function buildPoi({ fetch: doFetch = false } = {}) {
  if (!doFetch) return copyCache();

  const data = await fetchOverpass();
  const buckets = Object.fromEntries(POI_FILES.map((f) => [f, []]));
  for (const el of data.elements ?? []) {
    const item = slim(el);
    if (item) buckets[item.file].push(item.poi);
  }
  const generated_at = nowISO();
  let total = 0;
  for (const f of POI_FILES) {
    const poi = buckets[f].sort((a, b) => a.id.localeCompare(b.id));
    total += poi.length;
    writeJSON(`${OUT_DIR}/${f}`, { generated_at, source: "overpass", count: poi.length, poi });
    console.log(`build-poi: ${f} ← ${poi.length}`);
  }
  if (total < 500) throw new Error(`suspiciously few POIs (${total}) — refusing to promote`);
  return { status: "fresh", count: total, generated_at };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildPoi({ fetch: process.argv.includes("--fetch") }).catch((err) => {
    console.error("build-poi:", err.message);
    // --fetch failure leaves the committed cache untouched (weekly workflow
    // commits nothing); copy-mode failure should fail the deploy loudly.
    process.exitCode = process.argv.includes("--fetch") ? 0 : 1;
  });
}

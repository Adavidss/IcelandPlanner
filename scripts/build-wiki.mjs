// Wikipedia/Wikidata harvest (weekly):
//   1. wiki-enrich.json — Commons thumbnail + extract for each CURATED
//      attraction that has a wikipedia link (merged into attractions.json by
//      build-all; curated fields always win).
//   2. attractions-extra.json — the auto "more places" extended tier: notable
//      Iceland places from Wikidata (quality bar: has an English Wikipedia
//      article + coordinates), deduped against curated, capped.
//
// Modes mirror build-poi: --fetch harvests; default copies data/cache/.

import { fetchJSON, mapConcurrent } from "./lib/fetch.mjs";
import { haversineKm, inIcelandBBox, nowISO, readJSON, round5, writeJSON } from "./lib/io.mjs";

const OUT_DIR = "frontend/public/data";
const CACHE_DIR = "data/cache";
const CURATED = "data/curated/attractions.json";
const ENRICH = "wiki-enrich.json";
const EXTRA = "attractions-extra.json";
const CAP = 600;

// Wikidata P31 types → our category enum.
const TYPES = {
  Q34038: "waterfall",
  Q177380: "hot_spring",
  Q83471: "geothermal", // geyser
  Q35666: "glacier",
  Q8072: "crater", // volcano
  Q23397: "other", // lake
  Q150784: "canyon",
  Q35509: "cave",
  Q40080: "beach",
  Q8502: "viewpoint", // mountain
  Q33506: "museum",
  Q39715: "lighthouse_unused", // mapped below to viewpoint
};

const SPARQL = `SELECT ?item ?itemLabel ?coord ?type ?article WHERE {
  VALUES ?type { ${Object.keys(TYPES).map((q) => `wd:${q}`).join(" ")} }
  ?item wdt:P31 ?type ; wdt:P625 ?coord ; wdt:P17 wd:Q189 .
  ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;

function wikiTitle(url) {
  const m = /\/wiki\/([^#?]+)/.exec(url ?? "");
  return m ? decodeURIComponent(m[1]) : null;
}

async function summary(title) {
  try {
    const s = await fetchJSON(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { tries: 2, timeoutMs: 20_000 },
    );
    return {
      thumbnail: s?.thumbnail?.source ?? null,
      extract: (s?.extract ?? "").slice(0, 300) || null,
      wikipedia: s?.content_urls?.desktop?.page ?? null,
    };
  } catch {
    return null;
  }
}

function copyCache() {
  let ok = 0;
  for (const f of [ENRICH, EXTRA]) {
    const obj = readJSON(`${CACHE_DIR}/${f}`) ?? (f === ENRICH
      ? { generated_at: "", enrich: {} }
      : { generated_at: "", source: "wikidata", count: 0, attractions: [] });
    writeJSON(`${OUT_DIR}/${f}`, obj);
    if (f === EXTRA && obj.attractions?.length) ok = obj.attractions.length;
  }
  console.log(`build-wiki: copied cache (${ok} extended places)`);
  return { status: ok > 0 ? "cache" : "empty", count: ok };
}

export async function buildWiki({ fetch: doFetch = false } = {}) {
  if (!doFetch) return copyCache();

  const curated = readJSON(CURATED)?.attractions ?? [];

  // --- 1. enrich curated entries that link to Wikipedia -----------------
  const linked = curated.filter((a) => wikiTitle(a.links?.wikipedia));
  const enrich = {};
  const enriched = await mapConcurrent(linked, 4, 120, async (a) => {
    const s = await summary(wikiTitle(a.links.wikipedia));
    if (s) enrich[a.id] = s;
    return null;
  });
  void enriched;
  writeJSON(`${OUT_DIR}/${ENRICH}`, { generated_at: nowISO(), enrich });
  console.log(`build-wiki: enriched ${Object.keys(enrich).length}/${linked.length} curated entries`);

  // --- 2. extended tier from Wikidata ------------------------------------
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(SPARQL)}`;
  const res = await fetchJSON(url, { tries: 3, timeoutMs: 120_000, headers: { accept: "application/sparql-results+json" } });
  const rows = res?.results?.bindings ?? [];

  const seen = new Set();
  const candidates = [];
  for (const r of rows) {
    const qid = (r.item?.value ?? "").split("/").pop();
    if (!qid || seen.has(qid)) continue;
    seen.add(qid);
    const m = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(r.coord?.value ?? "");
    if (!m) continue;
    const lng = Number(m[1]);
    const lat = Number(m[2]);
    if (!inIcelandBBox(lat, lng)) continue;
    const typeQ = (r.type?.value ?? "").split("/").pop();
    let category = TYPES[typeQ] ?? "other";
    if (category === "lighthouse_unused") category = "viewpoint";
    const name = r.itemLabel?.value ?? "";
    if (!name || /^Q\d+$/.test(name)) continue;
    candidates.push({ qid, name, lat: round5(lat), lng: round5(lng), category, article: r.article?.value ?? null });
  }

  // Dedupe vs curated: same name (casefold) or within 500 m.
  const isDupe = (c) =>
    curated.some(
      (a) =>
        a.name.toLowerCase() === c.name.toLowerCase() ||
        haversineKm(a.lat, a.lng, c.lat, c.lng) < 0.5,
    );
  const fresh = candidates.filter((c) => !isDupe(c)).slice(0, CAP);

  const detailed = await mapConcurrent(fresh, 5, 100, async (c) => {
    const s = c.article ? await summary(wikiTitle(c.article)) : null;
    return {
      id: `wd-${c.qid}`,
      name: c.name,
      lat: c.lat,
      lng: c.lng,
      category: c.category,
      tier: "extended",
      extract: s?.extract ?? null,
      thumbnail: s?.thumbnail ?? null,
      links: { wikipedia: s?.wikipedia ?? c.article },
    };
  });
  const attractions = detailed
    .filter((a) => a && !a.__error)
    .sort((a, b) => a.id.localeCompare(b.id));

  writeJSON(`${OUT_DIR}/${EXTRA}`, { generated_at: nowISO(), source: "wikidata", count: attractions.length, attractions });
  console.log(`build-wiki: ${attractions.length} extended places (from ${candidates.length} candidates)`);
  return { status: "fresh", count: attractions.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildWiki({ fetch: process.argv.includes("--fetch") }).catch((err) => {
    console.error("build-wiki:", err.message);
    process.exitCode = process.argv.includes("--fetch") ? 0 : 1;
  });
}

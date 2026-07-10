// Tier-1 orchestrator: everything the daily deploy bakes into the site.
//
//   curated (validate; hard-fails on bad data)
//   → tours (re.is; cache-fallback)
//   → poi (copy committed cache)
//   → wiki (copy committed cache; merge enrich into attractions.json)
//   → meta.json
//
// --offline (CI/PRs): zero network — tours also come from cache.
// Exit 1 only if curated fails or if BOTH tours and poi are empty (never
// replace a working deploy with a data-less one).

import { buildCurated } from "./build-curated.mjs";
import { buildPoi } from "./build-poi.mjs";
import { buildTours } from "./build-tours.mjs";
import { buildWiki } from "./build-wiki.mjs";
import { nowISO, readJSON, writeJSON } from "./lib/io.mjs";

const OUT_DIR = "frontend/public/data";

function mergeEnrich() {
  const attractions = readJSON(`${OUT_DIR}/attractions.json`);
  const enrich = readJSON(`${OUT_DIR}/wiki-enrich.json`)?.enrich ?? {};
  if (!attractions?.attractions) return;
  let merged = 0;
  for (const a of attractions.attractions) {
    const e = enrich[a.id];
    if (!e) continue;
    // Curated always wins — wiki fills gaps only.
    if (!a.photo && e.thumbnail) {
      a.photo = { src: e.thumbnail, credit: "Wikimedia Commons", license: "see Commons page" };
    }
    if (!a.extract && e.extract) a.extract = e.extract;
    if (!a.links?.wikipedia && e.wikipedia) a.links = { ...a.links, wikipedia: e.wikipedia };
    merged++;
  }
  writeJSON(`${OUT_DIR}/attractions.json`, attractions);
  console.log(`build-all: wiki enrichment merged into ${merged} attractions`);
}

async function main() {
  const offline = process.argv.includes("--offline");
  const datasets = {};

  let curated;
  try {
    curated = buildCurated();
  } catch (err) {
    console.error(`build-all: curated data invalid — ${err.message}`);
    process.exit(1);
  }
  datasets.attractions = { ...curated.attractions, source: "curated", generated_at: nowISO() };
  datasets.routes = { ...curated.routes, source: "curated", generated_at: nowISO() };

  datasets.tours = { source: "re.is", ...(await buildTours({ offline })) };
  datasets.poi = { source: "overpass", ...(await buildPoi({ fetch: false })) };
  datasets.wiki = { source: "wikidata", ...(await buildWiki({ fetch: false })) };
  mergeEnrich();

  writeJSON(`${OUT_DIR}/meta.json`, {
    generated_at: nowISO(),
    datasets,
    map: {
      center: [64.9631, -19.0208],
      zoom: 6,
      bounds: [[63.2, -24.6], [66.7, -13.1]],
    },
    links: {
      roads: "https://umferdin.is/en",
      weather: "https://en.vedur.is",
      aurora: "https://en.vedur.is/weather/forecasts/aurora/",
      safetravel: "https://safetravel.is",
    },
  });

  const toursEmpty = datasets.tours.status === "empty";
  const poiEmpty = datasets.poi.status === "empty";
  console.log(
    `build-all: tours=${datasets.tours.status}(${datasets.tours.count}) poi=${datasets.poi.status}(${datasets.poi.count}) ` +
      `wiki=${datasets.wiki.status}(${datasets.wiki.count}) attractions=${datasets.attractions.count} routes=${datasets.routes.count}`,
  );
  if (toursEmpty && poiEmpty) {
    console.error("build-all: both tours and poi are EMPTY — refusing to ship a data-less deploy");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("build-all: unexpected", err);
  process.exit(1);
});

// Tier-1: Reykjavik Excursions tours → frontend/public/data/tours.json
//
// Source is re.is's Gatsby page-data (Contentful-backed, verified 2026-07):
//   listing:  /page-data/tours-activities/page-data.json
//             → result.data.allContentfulTour.edges[].node
//   details:  /page-data/tour/<slug>/page-data.json
//             → result.data.contentfulTour (season[], included, highlights, …)
//
// Never crashes the deploy: on failure it ships data/cache/tours.json
// (status "cache") or a typed empty file (status "empty"). Exit code 0 always;
// build-all.mjs reads the returned status for meta.json.

import { fetchJSON, mapConcurrent } from "./lib/fetch.mjs";
import { nowISO, readJSON, writeJSON } from "./lib/io.mjs";

const LISTING = "https://www.re.is/page-data/tours-activities/page-data.json";
const DETAIL = (slug) => `https://www.re.is/page-data/tour/${slug}/page-data.json`;
const OUT = "frontend/public/data/tours.json";
const CACHE = "data/cache/tours.json";
const MIN_TOURS = 100;

// Contentful season strings → month indexes (0 = Jan).
const SEASON_MONTHS = {
  winter: [10, 11, 0, 1, 2],
  spring: [3, 4],
  summer: [5, 6, 7],
  autumn: [8, 9],
  fall: [8, 9],
};

function monthsFromSeasons(seasons) {
  const months = new Array(12).fill(0);
  const list = Array.isArray(seasons) ? seasons : [];
  if (list.length === 0) return new Array(12).fill(2); // unspecified → year-round
  for (const s of list) {
    for (const m of SEASON_MONTHS[String(s).toLowerCase()] ?? []) months[m] = 2;
  }
  return months.some((v) => v > 0) ? months : new Array(12).fill(2);
}

/** Contentful long-text fields arrive as {fieldName: "markdown"} — unwrap. */
function longText(v) {
  if (v == null) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    for (const inner of Object.values(v)) {
      if (typeof inner === "string") return inner;
    }
  }
  return null;
}

/** "- item\n- item" markdown bullets → trimmed plain-text lines
 *  (also strips Contentful's __bold__ markers and [text](url) links). */
function bulletLines(v, cap, maxLen) {
  const t = longText(v);
  if (!t) return [];
  return t
    .split("\n")
    .map((l) =>
      l
        .replace(/^\s*[-*•]\s*/, "")
        .replace(/__([^_]*)__/g, "$1")
        .replace(/\*\*([^*]*)\*\*/g, "$1")
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
        .trim(),
    )
    .filter(Boolean)
    .slice(0, cap)
    .map((l) => (l.length > maxLen ? `${l.slice(0, maxLen - 1)}…` : l));
}

function imgUrl(node) {
  const src = node?.fluid?.src ?? node?.file?.url ?? null;
  if (!src) return null;
  return src.startsWith("//") ? `https:${src}` : src;
}

function slimListing(node) {
  return {
    id: String(node.productId ?? node.id),
    slug: node.slug,
    title: node.title ?? "",
    summary: (longText(node.summary) ?? "").slice(0, 300),
    category: (node.category ?? []).map((c) => c?.title).filter(Boolean),
    type: node.type ?? null,
    durationMin: Number.isFinite(node.durationMinutes) ? node.durationMinutes : null,
    priceFromISK: Number.isFinite(node.priceFrom) ? node.priceFrom : null,
    popularIndex: Number.isFinite(node.popularIndex) ? node.popularIndex : null,
    groupSize: node.groupSize ?? null,
    heroImage: imgUrl(node.heroImage),
    bookingUrl: `https://www.re.is/tour/${node.slug}/`,
  };
}

function mergeDetail(tour, d) {
  if (!d) return { ...tour, months: new Array(12).fill(2), images: [], included: [], highlights: [], needToKnow: [] };
  // tourHighlights is usually {tourHighlights: "__Name__ — blurb\n…"}; rarely an array.
  const highlights = Array.isArray(d.tourHighlights)
    ? d.tourHighlights.map((h) => longText(h) ?? h?.title).filter(Boolean).slice(0, 8)
    : bulletLines(d.tourHighlights ?? d.highlights, 8, 140);
  return {
    ...tour,
    months: monthsFromSeasons(d.season),
    seasonNote: Array.isArray(d.season) && d.season.length > 0 && d.season.length < 4 ? d.season.join(" · ") : null,
    difficulty: longText(d.difficulty),
    minimumAge: Number.isFinite(d.minimumAge) ? d.minimumAge : null,
    departsFrom: longText(d.departsFrom),
    duration: longText(d.duration),
    included: bulletLines(d.included, 10, 110),
    highlights,
    needToKnow: bulletLines(d.needToKnow, 8, 140),
    images: (Array.isArray(d.images) ? d.images : []).map(imgUrl).filter(Boolean).slice(0, 3),
  };
}

function findTourNodes(listing) {
  // Fixed path first; shape-probe fallback scans result.data for tour-ish arrays.
  const fixed = listing?.result?.data?.allContentfulTour?.edges;
  if (Array.isArray(fixed) && fixed.length > 0) return fixed.map((e) => e.node).filter(Boolean);
  const data = listing?.result?.data ?? {};
  for (const v of Object.values(data)) {
    const edges = v?.edges;
    if (Array.isArray(edges) && edges.length > 20 && edges[0]?.node?.slug && edges[0]?.node?.priceFrom !== undefined) {
      return edges.map((e) => e.node).filter(Boolean);
    }
  }
  return [];
}

function shipCache(reason) {
  const cached = readJSON(CACHE);
  if (cached?.tours?.length) {
    writeJSON(OUT, cached);
    console.error(`build-tours: ${reason} — shipped cache (${cached.tours.length} tours from ${cached.generated_at})`);
    return { status: "cache", count: cached.tours.length, generated_at: cached.generated_at };
  }
  const empty = { generated_at: nowISO(), source: "re.is", count: 0, tours: [] };
  writeJSON(OUT, empty);
  console.error(`build-tours: ${reason} — no cache either, shipped empty`);
  return { status: "empty", count: 0, generated_at: empty.generated_at };
}

export async function buildTours({ offline = false } = {}) {
  if (offline) return shipCache("offline mode");

  let nodes;
  try {
    nodes = findTourNodes(await fetchJSON(LISTING, { timeoutMs: 60_000 }));
  } catch (err) {
    return shipCache(`listing fetch failed (${err.message})`);
  }
  if (nodes.length < MIN_TOURS) {
    return shipCache(`listing shape suspicious (${nodes.length} tours < ${MIN_TOURS})`);
  }

  const base = nodes.map(slimListing);
  let detailFails = 0;
  const detailed = await mapConcurrent(base, 4, 150, async (tour) => {
    try {
      const d = await fetchJSON(DETAIL(tour.slug), { tries: 2, timeoutMs: 30_000 });
      return mergeDetail(tour, d?.result?.data?.contentfulTour ?? null);
    } catch {
      detailFails++;
      return mergeDetail(tour, null); // keep listing fields, defaults for detail
    }
  });

  const tours = detailed
    .filter((t) => t && !t.__error && t.slug && t.title)
    .sort((a, b) => (a.popularIndex ?? 9999) - (b.popularIndex ?? 9999) || a.title.localeCompare(b.title));

  if (tours.length < MIN_TOURS) return shipCache(`only ${tours.length} tours survived merge`);

  const out = { generated_at: nowISO(), source: "re.is", count: tours.length, tours };
  writeJSON(OUT, out);
  if (detailFails > 0) console.error(`build-tours: ${detailFails} detail pages failed (listing fields kept)`);
  console.log(`build-tours: ${tours.length} tours → ${OUT}`);
  return { status: "fresh", count: tours.length, generated_at: out.generated_at };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildTours({ offline: process.argv.includes("--offline") }).catch((err) => {
    console.error("build-tours: unexpected", err);
    shipCache("unexpected error");
  });
}

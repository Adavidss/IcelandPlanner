// Validate + publish the hand-authored data in data/curated/.
// Curated data lives in git, so a bad edit must FAIL the build loudly
// (exit 1 with file/field detail) — never ship silently-broken content.
//
// Outputs into frontend/public/data/:
//   attractions.json (wiki-enrich merged by build-all afterwards)
//   routes.json + routes/<id>.geojson
//   road-geometry.json (static segment geometry; conditions join on id live)

import { existsSync } from "node:fs";

import { inIcelandBBox, readJSON, writeJSON } from "./lib/io.mjs";

const OUT_DIR = "frontend/public/data";

const CATEGORIES = new Set([
  "waterfall", "glacier", "glacier_lagoon", "hot_spring", "geothermal", "beach",
  "canyon", "crater", "lava_field", "cave", "museum", "church", "viewpoint",
  "town", "wildlife", "pool", "other",
]);
const REGIONS = new Set([
  "capital", "reykjanes", "south", "southeast", "east", "northeast", "north",
  "westfjords", "west", "highlands",
]);
const ACCESS = new Set(["paved", "gravel", "f_road", "hike"]);

class ValidationError extends Error {}

function fail(file, msg) {
  throw new ValidationError(`${file}: ${msg}`);
}

function validateAttractions() {
  const file = "data/curated/attractions.json";
  const doc = readJSON(file);
  if (!doc || !Array.isArray(doc.attractions)) fail(file, "missing { attractions: [] }");
  const ids = new Set();
  for (const a of doc.attractions) {
    const where = `attraction "${a?.id ?? "?"}"`;
    if (!a.id || !/^[a-z0-9-]+$/.test(a.id)) fail(file, `${where}: id must be kebab-case`);
    if (ids.has(a.id)) fail(file, `${where}: duplicate id`);
    ids.add(a.id);
    if (!a.name) fail(file, `${where}: missing name`);
    if (!Number.isFinite(a.lat) || !Number.isFinite(a.lng) || !inIcelandBBox(a.lat, a.lng)) {
      fail(file, `${where}: lat/lng missing or outside Iceland (${a.lat}, ${a.lng})`);
    }
    if (!CATEGORIES.has(a.category)) fail(file, `${where}: bad category "${a.category}"`);
    if (!REGIONS.has(a.region)) fail(file, `${where}: bad region "${a.region}"`);
    if (!a.description) fail(file, `${where}: missing description`);
    if (!Array.isArray(a.months) || a.months.length !== 12 || a.months.some((m) => ![0, 1, 2, 3].includes(m))) {
      fail(file, `${where}: months must be 12 scores of 0–3`);
    }
    if (a.access && !ACCESS.has(a.access)) fail(file, `${where}: bad access "${a.access}"`);
    if (a.photo && (!a.photo.src || !a.photo.credit || !a.photo.license)) {
      fail(file, `${where}: photo needs src+credit+license (or null)`);
    }
  }
  return doc;
}

function validateRoutes(attractionIds) {
  const file = "data/curated/routes.json";
  const doc = readJSON(file);
  if (!doc || !Array.isArray(doc.routes)) fail(file, "missing { routes: [] }");
  const ids = new Set();
  for (const r of doc.routes) {
    const where = `route "${r?.id ?? "?"}"`;
    if (!r.id || ids.has(r.id)) fail(file, `${where}: missing/duplicate id`);
    ids.add(r.id);
    for (const k of ["name", "color", "description"]) if (!r[k]) fail(file, `${where}: missing ${k}`);
    if (!Number.isFinite(r.distanceKm) || !Number.isFinite(r.driveMin)) fail(file, `${where}: distanceKm/driveMin`);
    if (!Array.isArray(r.months) || r.months.length !== 12) fail(file, `${where}: months[12] required`);
    if (!Array.isArray(r.stops) || r.stops.length === 0) fail(file, `${where}: stops[] required`);
    for (const s of r.stops) {
      if (!attractionIds.has(s)) fail(file, `${where}: stop "${s}" is not a curated attraction id`);
    }
    const geoPath = `data/curated/routes/${r.id}.geojson`;
    if (!existsSync(geoPath)) fail(file, `${where}: missing ${geoPath}`);
    const geo = readJSON(geoPath);
    const line = geo?.features?.[0];
    if (geo?.type !== "FeatureCollection" || line?.geometry?.type !== "LineString") {
      fail(geoPath, "must be a FeatureCollection with one LineString feature");
    }
    const coords = line.geometry.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) fail(geoPath, "LineString needs ≥2 coords");
    for (const [lng, lat] of [coords[0], coords[coords.length - 1]]) {
      if (!inIcelandBBox(lat, lng)) fail(geoPath, `coords outside Iceland (are they [lng,lat]?)`);
    }
    r.geometry = `routes/${r.id}.geojson`;
  }
  return doc;
}

export function buildCurated() {
  const attractions = validateAttractions();
  const routes = validateRoutes(new Set(attractions.attractions.map((a) => a.id)));

  writeJSON(`${OUT_DIR}/attractions.json`, { version: 1, count: attractions.attractions.length, ...attractions });
  writeJSON(`${OUT_DIR}/routes.json`, { version: 1, count: routes.routes.length, ...routes });
  for (const r of routes.routes) {
    writeJSON(`${OUT_DIR}/routes/${r.id}.geojson`, readJSON(`data/curated/routes/${r.id}.geojson`));
  }

  // Static road-segment geometry (machine-generated once by
  // scripts/dev/make-road-geometry.mjs, committed). Optional until generated.
  const roadGeo = readJSON("data/curated/road-geometry.json");
  if (roadGeo?.segments?.length) {
    writeJSON(`${OUT_DIR}/road-geometry.json`, roadGeo);
  }

  console.log(
    `build-curated: ${attractions.attractions.length} attractions, ${routes.routes.length} routes` +
      `${roadGeo?.segments?.length ? `, ${roadGeo.segments.length} road segments` : " (no road geometry yet)"}`,
  );
  return {
    attractions: { status: "fresh", count: attractions.attractions.length },
    routes: { status: "fresh", count: routes.routes.length },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    buildCurated();
  } catch (err) {
    console.error(`build-curated: ${err.message}`);
    process.exit(1);
  }
}

// ONE-OFF developer tool: generate road-following GeoJSON for each driving
// route in data/curated/routes.json by routing through its stops with the
// public OSRM demo server, then simplify and write
// data/curated/routes/<id>.geojson (committed).
//
// Waypoints = the route's stops' coordinates (from attractions.json) plus an
// optional `via` list of extra [lat,lng] shaping points in routes.json.
// Falls back to straight lines between stops if OSRM fails (schematic but
// usable; re-run later for pretty lines).
//
//   node scripts/dev/make-route-geojson.mjs [route-id …]

import { readJSON, round5, thinLine, writeJSON } from "../lib/io.mjs";

const OSRM = "https://router.project-osrm.org/route/v1/driving/";
const UA = "IcelandPlanner/1.0 (+https://github.com/Adavidss/IcelandPlanner)";
const MIN_KM = 0.5;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const routesDoc = readJSON("data/curated/routes.json");
const attractions = readJSON("data/curated/attractions.json")?.attractions ?? [];
const byId = new Map(attractions.map((a) => [a.id, a]));
if (!routesDoc?.routes) {
  console.error("data/curated/routes.json missing");
  process.exit(1);
}

const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));

async function osrmLeg(points) {
  // OSRM wants lng,lat;lng,lat — cap ~90 waypoints per request (demo limit ~100).
  const coords = points.map(([lat, lng]) => `${lng},${lat}`).join(";");
  const url = `${OSRM}${coords}?overview=full&geometries=geojson&continue_straight=true`;
  const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const j = await res.json();
  if (j.code !== "Ok" || !j.routes?.[0]?.geometry?.coordinates) throw new Error(`OSRM code ${j.code}`);
  return j.routes[0].geometry.coordinates.map(([lng, lat]) => [round5(lat), round5(lng)]);
}

for (const route of routesDoc.routes) {
  if (only.length > 0 && !only.includes(route.id)) continue;
  const stopPts = route.stops.map((s) => {
    const a = byId.get(s);
    if (!a) throw new Error(`route ${route.id}: unknown stop ${s}`);
    return [a.lat, a.lng];
  });
  // Insert optional shaping points: routes.json may carry `via: {afterStop: [[lat,lng],…]}`
  // keyed by stop index, or a flat `viaAll` appended between first and last.
  const pts = [];
  for (let i = 0; i < stopPts.length; i++) {
    pts.push(stopPts[i]);
    for (const v of route.via?.[String(i)] ?? []) pts.push(v);
  }
  if (route.loop && pts.length > 1) pts.push(pts[0]);

  let line;
  try {
    line = await osrmLeg(pts);
    console.log(`${route.id}: OSRM ok (${line.length} pts)`);
  } catch (err) {
    console.error(`${route.id}: OSRM failed (${err.message}) — writing straight-line fallback`);
    line = pts;
  }
  const thin = thinLine(line, MIN_KM);
  writeJSON(`data/curated/routes/${route.id}.geojson`, {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { id: route.id },
        geometry: { type: "LineString", coordinates: thin.map(([lat, lng]) => [lng, lat]) },
      },
    ],
  });
  console.log(`${route.id}: wrote ${thin.length} points`);
  await sleep(1200); // be polite to the demo server
}
console.log("make-route-geojson: done");

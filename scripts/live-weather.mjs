// Tier-2: Veðurstofa forecasts (xmlweather) → <out>/weather.json
//
// One batched request for every station in data/curated/stations.json.
// XML shape (verified 2026-07): <forecasts><station id valid><name><atime>
//   <forecast><ftime>…<F>wind m/s<D>dir<T>°C<W>description
// Stations missing/invalid in the response are skipped, not fatal.

import { fetchText } from "./lib/fetch.mjs";
import { nowISO, payloadHash, readJSON, writeJSON } from "./lib/io.mjs";
import { blocks, text } from "./lib/xml.mjs";

const BASE = "https://xmlweather.vedur.is/";

export async function liveWeather(outDir) {
  const registry = readJSON("data/curated/stations.json")?.stations ?? [];
  if (registry.length === 0) throw new Error("data/curated/stations.json is empty");
  const byId = new Map(registry.map((s) => [String(s.id), s]));

  const ids = registry.map((s) => s.id).join(";");
  const xml = await fetchText(
    `${BASE}?op_w=xml&type=forec&lang=en&view=xml&ids=${encodeURIComponent(ids)}`,
    { timeoutMs: 45_000 },
  );

  const stations = [];
  for (const st of blocks(xml, "station")) {
    const meta = byId.get(String(st.attrs.id));
    if (!meta || st.attrs.valid === "0") continue;
    const forecast = [];
    for (const f of blocks(st.inner, "forecast")) {
      const time = text(f.inner, "ftime");
      if (!time) continue;
      const num = (tag) => {
        const v = text(f.inner, tag);
        const n = Number(v);
        return v !== null && Number.isFinite(n) ? n : null;
      };
      forecast.push({
        time,
        windMs: num("F"),
        windDir: text(f.inner, "D"),
        tempC: num("T"),
        desc: text(f.inner, "W"),
        precipMm: num("R"),
        cloudPct: num("N"),
      });
    }
    if (forecast.length === 0) continue;
    stations.push({
      id: meta.id,
      name: meta.name,
      region: meta.region,
      lat: meta.lat,
      lng: meta.lng,
      atime: text(st.inner, "atime"),
      forecast: forecast.slice(0, 72),
    });
  }

  if (stations.length === 0) throw new Error("no valid stations in response");

  const out = { updated_at: nowISO(), source: "xmlweather.vedur.is", stations };
  const path = `${outDir}/weather.json`;
  const prev = readJSON(path);
  const changed = !prev || payloadHash(prev) !== payloadHash(out);
  if (changed) writeJSON(path, out);
  console.log(`live-weather: ${stations.length}/${registry.length} stations (${changed ? "changed" : "unchanged"})`);
  return { changed, updated_at: changed ? out.updated_at : prev?.updated_at ?? out.updated_at };
}

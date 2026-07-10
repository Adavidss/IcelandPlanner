// Tier-2: Vegagerðin road conditions → <out>/roads.json (conditions ONLY —
// segment geometry is static, shipped tier-1 as road-geometry.json, joined
// client-side on segment id; this keeps the every-30-min file ~60 KB).
//
// Throws on failure — live-all.mjs catches and keeps the previous file.

import { fetchJSON } from "./lib/fetch.mjs";
import { nowISO, payloadHash, readJSON, writeJSON } from "./lib/io.mjs";
import { legend, mapCondition } from "./lib/road-conditions.mjs";

const SOURCE = "https://gagnaveita.vegagerdin.is/api/faerd2017_1";

export async function liveRoads(outDir) {
  const raw = await fetchJSON(SOURCE, { timeoutMs: 45_000 });
  if (!Array.isArray(raw) || raw.length < 100) {
    throw new Error(`suspicious payload (${Array.isArray(raw) ? raw.length : typeof raw} segments)`);
  }

  const unknownCodes = new Set();
  const segments = raw
    .map((s) => {
      const cond = mapCondition(s.AstandYfirbord);
      if (!cond.known && s.AstandYfirbord) unknownCodes.add(s.AstandYfirbord);
      return {
        id: Number(s.IdButur),
        name: s.StuttNafnButs ?? s.FulltNafnButs ?? "",
        condition: cond.condition,
        label: s.AstandLysingEn || cond.label,
        recordedAt: s.DagsSkrad ?? null,
      };
    })
    .filter((s) => Number.isFinite(s.id))
    .sort((a, b) => a.id - b.id);

  if (unknownCodes.size > 0) {
    console.error(`live-roads: unmapped Astand codes → unknown: ${[...unknownCodes].join(", ")}`);
  }

  const counts = {};
  for (const s of segments) counts[s.condition] = (counts[s.condition] ?? 0) + 1;

  const out = { updated_at: nowISO(), source: SOURCE, legend: legend(), counts, segments };
  const path = `${outDir}/roads.json`;
  const prev = readJSON(path);
  const changed = !prev || payloadHash(prev) !== payloadHash(out);
  if (changed) writeJSON(path, out);
  console.log(`live-roads: ${segments.length} segments (${changed ? "changed" : "unchanged"})`);
  return { changed, updated_at: changed ? out.updated_at : prev?.updated_at ?? out.updated_at };
}

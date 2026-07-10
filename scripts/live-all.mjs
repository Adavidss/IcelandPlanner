// Tier-2 orchestrator, run every 30 min by live-data.yml with
// --out data-branch (the checked-out orphan `data` branch worktree).
//
// Each dataset is independent; failures land in status.json, never as a
// nonzero exit (a red run every 30 min is alert spam — status.json IS the
// health signal the frontend reads). Payload files are only rewritten when
// content changes; status.json changes every run (pipeline liveness).

import { mkdirSync } from "node:fs";

import { nowISO, readJSON, writeJSON } from "./lib/io.mjs";
import { liveHazards } from "./live-hazards.mjs";
import { liveRoads } from "./live-roads.mjs";
import { liveWeather } from "./live-weather.mjs";

const outFlag = process.argv.indexOf("--out");
const OUT_DIR = outFlag !== -1 && process.argv[outFlag + 1] ? process.argv[outFlag + 1] : "data-branch";

const JOBS = [
  ["roads", liveRoads],
  ["weather", liveWeather],
  ["hazards", liveHazards],
];

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const datasets = {};
  for (const [name, fn] of JOBS) {
    try {
      const r = await fn(OUT_DIR);
      datasets[name] = { ok: true, changed: r.changed, updated_at: r.updated_at, error: null };
    } catch (err) {
      const prev = readJSON(`${OUT_DIR}/${name}.json`);
      datasets[name] = {
        ok: false,
        changed: false,
        updated_at: prev?.updated_at ?? null,
        error: String(err.message ?? err).slice(0, 200),
      };
      console.error(`live-all: ${name} FAILED — ${datasets[name].error} (previous file kept)`);
    }
  }
  writeJSON(`${OUT_DIR}/status.json`, {
    run_at: nowISO(),
    run_id: Number(process.env.GITHUB_RUN_ID ?? 0) || null,
    datasets,
  });
  const summary = Object.entries(datasets)
    .map(([k, v]) => `${k}:${v.ok ? (v.changed ? "updated" : "unchanged") : "FAILED"}`)
    .join(" ");
  console.log(`live-all: ${summary} → ${OUT_DIR}/`);
}

main().catch((err) => {
  // Even the orchestrator crashing shouldn't fail the workflow run.
  console.error("live-all: unexpected", err);
});

// Promote freshly-fetched weekly outputs from frontend/public/data/ into the
// committed data/cache/ (the permanent last-good fallback every deploy uses).
// Refuses to overwrite cache with empty/stale output — a failed fetch week
// must cost nothing.

import { POI_FILES } from "./build-poi.mjs";
import { readJSON, writeJSON } from "./lib/io.mjs";

const SRC = "frontend/public/data";
const DST = "data/cache";

const CANDIDATES = [
  { file: "tours.json", ok: (o) => (o?.tours?.length ?? 0) >= 100 },
  ...POI_FILES.map((f) => ({ file: f, ok: (o) => (o?.poi?.length ?? 0) > 0 })),
  { file: "wiki-enrich.json", ok: (o) => Object.keys(o?.enrich ?? {}).length > 0 },
  { file: "attractions-extra.json", ok: (o) => (o?.attractions?.length ?? 0) > 0 },
];

let promoted = 0;
for (const { file, ok } of CANDIDATES) {
  const fresh = readJSON(`${SRC}/${file}`);
  if (!fresh || !ok(fresh)) {
    console.log(`snapshot-cache: skip ${file} (missing or fails quality bar)`);
    continue;
  }
  const prev = readJSON(`${DST}/${file}`);
  // Never replace newer cache with older output (shouldn't happen, but cheap).
  if (prev?.generated_at && fresh.generated_at && fresh.generated_at < prev.generated_at) {
    console.log(`snapshot-cache: skip ${file} (older than cache)`);
    continue;
  }
  writeJSON(`${DST}/${file}`, fresh);
  promoted++;
  console.log(`snapshot-cache: promoted ${file}`);
}
console.log(`snapshot-cache: ${promoted}/${CANDIDATES.length} files promoted`);

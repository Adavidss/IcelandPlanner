// File + geometry utilities shared by all data scripts.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** Atomic compact-JSON write (tmp + rename) so a crash never leaves half a file. */
export function writeJSON(path, obj) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(obj));
  renameSync(tmp, path);
}

export function readJSON(path, fallback = null) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

/** SHA-256 of the payload with volatile timestamp keys stripped — drives
 *  skip-if-unchanged so tier-2 files keep their content-change timestamps. */
export function payloadHash(obj) {
  const clone = JSON.parse(JSON.stringify(obj, (k, v) =>
    k === "updated_at" || k === "generated_at" || k === "run_at" || k === "run_id" ? undefined : v,
  ));
  return createHash("sha256").update(JSON.stringify(clone)).digest("hex");
}

export const round5 = (n) => Math.round(n * 1e5) / 1e5;

/** Generous Iceland bounding box (includes Grímsey/Kolbeinsey). */
export function inIcelandBBox(lat, lng) {
  return lat >= 62.8 && lat <= 67.5 && lng >= -25.5 && lng <= -12.5;
}

export const nowISO = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

/** Haversine distance in km. */
export function haversineKm(aLat, aLng, bLat, bLng) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Thin a polyline: keep points at least minKm apart (always keep endpoints). */
export function thinLine(points, minKm) {
  if (points.length <= 2) return points;
  const out = [points[0]];
  let last = points[0];
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    if (haversineKm(last[0], last[1], p[0], p[1]) >= minKm) {
      out.push(p);
      last = p;
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

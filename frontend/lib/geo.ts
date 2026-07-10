// Distance + drive-time estimates. Straight-line × road factor — honest
// ballparks for planning, always labeled as estimates in the UI.

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const ROAD_FACTOR = 1.3; // Iceland's roads wind around fjords
const KMH_SUMMER = 75;
const KMH_WINTER = 65;

export interface DriveEstimate {
  km: number;
  minutes: number;
  label: string; // "~1 h 40 m · ~118 km"
}

export function formatDriveMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")} m` : `${m} min`;
}

/** month 0–11 → winter speeds Nov–Mar. */
export function driveEstimate(
  aLat: number, aLng: number, bLat: number, bLng: number, month: number,
): DriveEstimate {
  const km = haversineKm(aLat, aLng, bLat, bLng) * ROAD_FACTOR;
  const kmh = month >= 10 || month <= 2 ? KMH_WINTER : KMH_SUMMER;
  const minutes = (km / kmh) * 60;
  return { km, minutes, label: `~${formatDriveMinutes(minutes)} · ~${Math.round(km)} km` };
}

export function distanceLabel(km: number): string {
  return km < 1 ? "<1 km away" : `${Math.round(km)} km away`;
}

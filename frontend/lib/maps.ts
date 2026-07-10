// Google Maps deep links (no API key): per-leg directions and per-day
// multi-waypoint routes. Google caps waypoints at 9 (11 points including
// origin/destination) — extra intermediate stops are thinned evenly.

interface Pt {
  lat: number;
  lng: number;
}

const pt = (p: Pt) => `${p.lat},${p.lng}`;

/** Simple A→B driving directions. */
export function legUrl(from: Pt | null, to: Pt): string {
  const origin = from ? `origin=${pt(from)}&` : ""; // omitted = device's current location
  return `https://www.google.com/maps/dir/?api=1&${origin}destination=${pt(to)}&travelmode=driving`;
}

export interface DayRoute {
  url: string;
  /** Stops actually included (Google's waypoint cap may thin the middle). */
  included: number;
  total: number;
}

/** Whole-day route through every stop with coordinates. */
export function dayRouteUrl(points: Pt[]): DayRoute | null {
  if (points.length < 2) return null;
  const origin = points[0];
  const destination = points[points.length - 1];
  let middle = points.slice(1, -1);
  const total = points.length;
  const CAP = 9;
  if (middle.length > CAP) {
    // Thin evenly, always keeping relative order.
    const step = middle.length / CAP;
    middle = Array.from({ length: CAP }, (_, i) => middle[Math.floor(i * step)]);
  }
  const waypoints = middle.length > 0 ? `&waypoints=${middle.map(pt).join("|")}` : "";
  return {
    url: `https://www.google.com/maps/dir/?api=1&origin=${pt(origin)}&destination=${pt(destination)}${waypoints}&travelmode=driving`,
    included: middle.length + 2,
    total,
  };
}

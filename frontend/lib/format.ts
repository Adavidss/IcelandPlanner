// Formatting helpers. Pipeline timestamps are real ISO-8601 UTC (Date math is
// fine); vedur forecast times are zone-less Iceland-local strings — those are
// formatted by string parsing ONLY (never `new Date(str)`), a discipline
// carried over from BirdTracker's eBird handling.

export function formatISK(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "";
  return `${new Intl.NumberFormat("de-DE").format(n)} kr.`; // 14.990 kr. — Icelandic style
}

export function formatDuration(min: number | null): string {
  if (min === null || !Number.isFinite(min)) return "";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (min >= 60 * 24) {
    const days = Math.round(min / (60 * 24));
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  return m > 0 ? `${h} h ${String(m).padStart(2, "0")} m` : `${h} h`;
}

/** For ISO UTC timestamps (meta.generated_at, roads.updated_at): "42m ago". */
export function formatUpdated(iso: string | null | undefined): string {
  if (!iso) return "recently";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "recently";
  const mins = Math.max(0, Math.round((Date.now() - t) / 60_000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

const VEDUR_RE = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/;

/** Zone-less vedur "2026-07-10 12:00:00" → "Thu 12:00" (string parsing only). */
export function formatForecastTime(s: string): string {
  const m = VEDUR_RE.exec(s);
  if (!m) return s;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
  return `${weekday} ${m[4]}:${m[5]}`;
}

/** "2026-09-12" + trip day formatting: "Fri, Sep 12". Constructed, not parsed. */
export function formatTripDate(d: Date): string {
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
  return `${weekday}, ${month} ${d.getDate()}`;
}

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

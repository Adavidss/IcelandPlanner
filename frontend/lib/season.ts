// Season math over the curated 12-month score arrays (Jan-first, 0–3):
//   0 closed/inaccessible · 1 possible · 2 good · 3 peak
// The 12-month adaptation of BirdTracker's 48-week season.ts.

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const wrap = (m: number) => ((m % 12) + 12) % 12;

export function scoreAt(months: number[] | undefined, m: number): number {
  if (!months || months.length !== 12) return 2; // unknown → assume fine
  return months[wrap(m)] ?? 0;
}

/** score[next month] − score[this month]; negative = fading out (last chance). */
export function trend(months: number[] | undefined, m: number): number {
  return scoreAt(months, m + 1) - scoreAt(months, m);
}

export interface SeasonBadgeInfo {
  label: string;
  tone: "peak" | "good" | "shoulder" | "closed";
}

/** The badge every card/popup/stop shows for the chosen travel month. */
export function badgeFor(
  item: { months?: number[]; tags?: string[]; seasonNote?: string | null },
  m: number,
): SeasonBadgeInfo | null {
  const tags = item.tags ?? [];
  const s = scoreAt(item.months, m);
  const isFRoad = tags.includes("fRoad");
  if (s === 0) {
    if (isFRoad) return { label: "F-road — closed for your dates", tone: "closed" };
    if (tags.includes("puffins")) return { label: "Wildlife gone this month", tone: "closed" };
    return { label: "Not accessible", tone: "closed" };
  }
  if (s === 1) return { label: "Shoulder — check conditions", tone: "shoulder" };
  if (s === 3) return { label: "Peak season", tone: "peak" };
  if (!item.months) return null; // unknown months (extended tier) → no badge
  return { label: "In season", tone: "good" };
}

/** Items reliably good in month m (score ≥ min), best first. */
export function goodInMonth<T extends { months?: number[] }>(items: T[], m: number, min = 2): T[] {
  return items
    .filter((it) => scoreAt(it.months, m) >= min)
    .sort((a, b) => scoreAt(b.months, m) - scoreAt(a.months, m));
}

/** Fading out after month m — "last chance". */
export function lastChance<T extends { months?: number[] }>(items: T[], m: number): T[] {
  return items.filter((it) => scoreAt(it.months, m) >= 2 && trend(it.months, m) < 0);
}

/** Coming into season next month. */
export function comingUp<T extends { months?: number[] }>(items: T[], m: number): T[] {
  return items.filter((it) => scoreAt(it.months, m) <= 1 && scoreAt(it.months, m + 1) >= 2);
}

export function inSeason(item: { months?: number[] }, m: number): boolean {
  return scoreAt(item.months, m) >= 2;
}

/** Aurora is realistic Sep–Apr (dark skies); midnight sun peaks Jun–Jul. */
export const isAuroraMonth = (m: number) => m >= 8 || m <= 3;
export const isMidnightSunMonth = (m: number) => m === 5 || m === 6;

/** Month bucket → the editorial discovery theme on Home. */
export function monthTheme(m: number): { title: string; blurb: string; tag: string } {
  if (m >= 10 || m <= 2)
    return {
      title: "Chasing the aurora",
      blurb: "Long dark nights — the best aurora odds of the year. These spots pair dark skies with a foreground worth the photo.",
      tag: "auroraSpot",
    };
  if (m >= 4 && m <= 7)
    return {
      title: "Puffin season",
      blurb: "Iceland hosts most of the world's Atlantic puffins from May to early August. These colonies get you close.",
      tag: "puffins",
    };
  if (m === 3)
    return {
      title: "Winter's last stand",
      blurb: "Ice caves and snowy peaks are still going, days are already long — March–April is Iceland's secret sweet spot.",
      tag: "family",
    };
  return {
    title: "Highlands open",
    blurb: "The F-roads are open — Landmannalaugar, Askja and the interior are reachable at last. Summer-only Iceland.",
    tag: "fRoad",
  };
}

"use client";

// The month-aware chip on every card, popup, row and planner stop.

import { badgeFor } from "@/lib/season";
import { useSeason } from "@/lib/season-context";

const TONE_CLASSES: Record<string, string> = {
  peak: "bg-aurora/15 text-aurora ring-aurora/40",
  good: "bg-surface-2 text-fg ring-border",
  shoulder: "bg-warn/15 text-warn ring-warn/40",
  closed: "bg-danger/15 text-danger ring-danger/40",
};

export function SeasonBadge({
  item,
  month,
  className = "",
}: {
  item: { months?: number[]; tags?: string[]; seasonNote?: string | null };
  /** Override the global travel month (planner uses the day's real month). */
  month?: number;
  className?: string;
}) {
  const season = useSeason();
  const m = month ?? season.month;
  const badge = badgeFor(item, m);
  if (!badge) return null;
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${TONE_CLASSES[badge.tone]} ${className}`}
      title={item.seasonNote ?? undefined}
    >
      {badge.label}
    </span>
  );
}

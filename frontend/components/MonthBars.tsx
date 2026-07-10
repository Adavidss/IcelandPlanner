// 12-month goodness chart (SVG) with a dashed "your month" line —
// the 12-bar simplification of BirdTracker's SeasonBars.

"use client";

import { MONTH_NAMES } from "@/lib/season";
import { useSeason } from "@/lib/season-context";

const LETTERS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const X0 = 3;
const TOP = 16;
const BASE = 78;
const COL = 26;
const LABELS = ["Closed", "Possible", "Good", "Peak"];

export function MonthBars({ months }: { months?: number[] }) {
  const { month } = useSeason();
  if (!months || months.length !== 12) return null;

  return (
    <div>
      <svg viewBox="0 0 318 90" className="w-full max-w-md text-aurora" role="img" aria-label="Best months of the year">
        {LETTERS.map((letter, m) => (
          <text key={`t${m}`} x={X0 + m * COL + COL / 2} y={11} textAnchor="middle" fontSize={9.5} fill="rgb(var(--c-muted))">
            {letter}
          </text>
        ))}
        {Array.from({ length: 13 }, (_, m) => (
          <line key={`s${m}`} x1={X0 + m * COL} y1={TOP} x2={X0 + m * COL} y2={BASE} stroke="rgb(var(--c-border))" strokeWidth={0.75} />
        ))}
        {months.map((score, m) => {
          const h = score > 0 ? Math.max(4, (score / 3) * (BASE - TOP - 4)) : 0;
          return (
            <g key={m}>
              <title>{`${MONTH_NAMES[m]} — ${LABELS[score] ?? "?"}`}</title>
              <rect x={X0 + m * COL} y={TOP} width={COL} height={BASE - TOP} fill="transparent" />
              {h > 0 ? (
                <rect x={X0 + m * COL + 4} y={BASE - h} width={COL - 8} height={h} rx={2} fill="currentColor" fillOpacity={score === 3 ? 0.95 : score === 2 ? 0.65 : 0.3} />
              ) : (
                <rect x={X0 + m * COL + 4} y={BASE - 2} width={COL - 8} height={2} fill="rgb(var(--c-border))" />
              )}
            </g>
          );
        })}
        <line x1={X0} y1={BASE + 0.5} x2={X0 + 12 * COL} y2={BASE + 0.5} stroke="rgb(var(--c-muted))" strokeWidth={1} />
        <line
          x1={X0 + month * COL + COL / 2}
          y1={TOP}
          x2={X0 + month * COL + COL / 2}
          y2={BASE}
          stroke="rgb(var(--c-fg))"
          strokeWidth={1.25}
          strokeDasharray="3 3"
          opacity={0.7}
        />
      </svg>
      <p className="mt-1 text-[10px] text-muted">
        Bar height = how good that month is · dashed line = your travel month. Hover a month for details.
      </p>
    </div>
  );
}

"use client";

// Aurora card, rendered only in aurora months (Sep–Apr): live NOAA Kp when
// your travel month is the current month, informational otherwise.
// Jun–Jul callers should render the Midnight Sun card instead (Home does).

import { useEffect, useState } from "react";

import { AuroraIcon } from "@/components/icons";
import { daylightFor, REYKJAVIK } from "@/lib/daylight";
import { EXTERNAL, fetchKp, type KpNow } from "@/lib/live";
import { isAuroraMonth, MONTH_NAMES } from "@/lib/season";
import { useSeason } from "@/lib/season-context";

function verdict(kp: number): string {
  if (kp >= 6) return "Strong storm — visible even from town if skies are clear!";
  if (kp >= 4) return "Active — well worth heading somewhere dark.";
  if (kp >= 2) return "Moderate — possible away from lights under clear skies.";
  return "Quiet — a faint show is still possible on clear dark nights.";
}

export function AuroraPanel() {
  const { month, date } = useSeason();
  const [kp, setKp] = useState<KpNow | null>(null);
  const isNow = month === new Date().getMonth();

  useEffect(() => {
    if (isNow && isAuroraMonth(month)) fetchKp().then(setKp);
  }, [isNow, month]);

  if (!isAuroraMonth(month)) return null;

  const dark = daylightFor(date, REYKJAVIK.lat, REYKJAVIK.lng).darkWindow;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-strong">
        <AuroraIcon size={16} className="text-aurora" /> Aurora
      </div>
      {isNow && kp ? (
        <>
          <p className="mt-2 text-2xl font-semibold text-strong">
            Kp {kp.kp}
            <span className="ml-2 align-middle text-xs font-normal text-muted">now (NOAA)</span>
          </p>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className={`h-full rounded-full ${kp.kp >= 4 ? "bg-aurora" : "bg-aurora/50"}`}
              style={{ width: `${Math.min(100, (kp.kp / 9) * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-muted">{verdict(kp.kp)}</p>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted">
          {MONTH_NAMES[month]} nights are properly dark{dark ? ` (~${dark})` : ""} — aurora is on the menu when
          skies clear. Check the Kp index and cloud forecast once you&apos;re there.
        </p>
      )}
      {dark && isNow && <p className="mt-1 text-xs text-muted">Dark window tonight: {dark}</p>}
      <a
        href={EXTERNAL.aurora}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-block text-xs font-medium text-aurora hover:underline"
      >
        Cloud-cover forecast (vedur.is) ↗
      </a>
    </div>
  );
}

export function MidnightSunCard() {
  const { month, date } = useSeason();
  if (month !== 5 && month !== 6) return null;
  const d = daylightFor(date, REYKJAVIK.lat, REYKJAVIK.lng);
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-strong">
        <AuroraIcon size={16} className="text-warn" /> Midnight sun
      </div>
      <p className="mt-2 text-sm text-muted">
        {d.edge === "midnight-sun" ? "The sun barely sets" : `Days run ${d.dayLengthLabel}`} — no aurora this time
        of year, but golden light lasts for hours and you can sightsee at midnight.
      </p>
    </div>
  );
}

"use client";

// Sunrise/sunset/day-length for a date + place (SunCalc, Iceland time).

import { SunIcon } from "@/components/icons";
import { daylightFor, REYKJAVIK } from "@/lib/daylight";

export function DaylightCard({
  date,
  lat = REYKJAVIK.lat,
  lng = REYKJAVIK.lng,
  placeName = "Reykjavík",
  compact = false,
}: {
  date: Date;
  lat?: number;
  lng?: number;
  placeName?: string;
  compact?: boolean;
}) {
  const d = daylightFor(date, lat, lng);

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-fg">
        <SunIcon size={14} className="text-warn" />
        {d.sunrise && d.sunset ? (
          <>
            {d.sunrise}–{d.sunset} · {d.dayLengthLabel}
          </>
        ) : (
          d.dayLengthLabel
        )}
      </span>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-strong">
        <SunIcon size={16} className="text-warn" /> Daylight · {placeName}
      </div>
      {d.sunrise && d.sunset ? (
        <>
          <p className="mt-2 text-2xl font-semibold text-strong">{d.dayLengthLabel}</p>
          <p className="mt-1 text-sm text-muted">
            Sun {d.sunrise} – {d.sunset}
            {d.goldenEvening && <> · golden hour ~{d.goldenEvening}</>}
          </p>
        </>
      ) : (
        <p className="mt-2 text-lg font-semibold text-strong">{d.dayLengthLabel}</p>
      )}
      {d.edge === "midnight-sun" && (
        <p className="mt-1 text-xs text-muted">Midnight sun — bring a sleep mask, plan late-night sightseeing.</p>
      )}
      {d.edge === "polar-twilight" && (
        <p className="mt-1 text-xs text-muted">Only a few dim hours — plan drives inside the light window.</p>
      )}
    </div>
  );
}

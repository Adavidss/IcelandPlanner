"use client";

// Safety widgets: alerts banner, conditions legend, weather strip,
// Reynisfjara indicator, seasonal drive checklist.

import { useEffect, useState } from "react";

import { WindIcon } from "@/components/icons";
import { formatUpdated, httpUrl } from "@/lib/format";
import { EXTERNAL, fetchAlerts, type TravelAlert } from "@/lib/live";
import { useSeason } from "@/lib/season-context";
import type { HazardsFile, RoadsFile, StationForecast } from "@/lib/types";

export function AlertsBanner() {
  const [alerts, setAlerts] = useState<TravelAlert[] | null>(null);
  useEffect(() => {
    fetchAlerts().then(setAlerts);
  }, []);
  if (!alerts || alerts.length === 0) return null; // quiet or unreachable → nothing
  return (
    <div className="no-print mb-4 space-y-2">
      {alerts.slice(0, 3).map((a) => (
        <a
          key={a.id}
          href={httpUrl(a.link) ?? EXTERNAL.safetravel}
          target="_blank"
          rel="noreferrer"
          className="block rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 hover:bg-warn/15"
        >
          <p className="text-sm font-semibold text-warn">⚠ {a.title}</p>
          {a.body && <p className="mt-0.5 line-clamp-2 text-xs text-fg">{a.body}</p>}
          <p className="mt-0.5 text-[11px] text-muted">safetravel.is</p>
        </a>
      ))}
    </div>
  );
}

export function ConditionsLegend({ roads }: { roads: RoadsFile }) {
  const entries = Object.entries(roads.legend).filter(([k]) => (roads.counts[k as keyof typeof roads.counts] ?? 0) > 0 || ["good", "slippery", "impassable", "closed"].includes(k));
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
      {entries.map(([key, e]) => (
        <span key={key} className="inline-flex items-center gap-1.5 text-muted">
          <span className="h-2.5 w-5 rounded-sm" style={{ background: e.color, outline: "1px solid rgb(var(--c-border))" }} />
          {e.label}
          {(roads.counts[key as keyof typeof roads.counts] ?? 0) > 0 && (
            <span className="text-[10px]">({roads.counts[key as keyof typeof roads.counts]})</span>
          )}
        </span>
      ))}
    </div>
  );
}

export function WeatherStrip({ stations }: { stations: StationForecast[] }) {
  return (
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
      {stations.map((s) => {
        const now = s.forecast[0];
        if (!now) return null;
        const wind = now.windMs ?? 0;
        const tone = wind >= 20 ? "border-danger/50 bg-danger/10" : wind >= 15 ? "border-warn/50 bg-warn/10" : "border-border bg-surface";
        return (
          <div key={s.id} className={`w-40 shrink-0 snap-start rounded-xl border p-3 ${tone}`}>
            <p className="truncate text-xs font-medium text-strong">{s.name}</p>
            <p className="mt-1.5 flex items-center gap-1 text-lg font-semibold text-strong">
              <WindIcon size={15} className={wind >= 15 ? "text-warn" : "text-muted"} />
              {now.windMs ?? "–"} <span className="text-xs font-normal text-muted">m/s {now.windDir ?? ""}</span>
            </p>
            <p className="mt-0.5 text-sm text-fg">
              {now.tempC !== null ? `${now.tempC}°C` : "–"}
              {now.desc && <span className="text-muted"> · {now.desc}</span>}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function ReynisfjaraCard({ hazards }: { hazards: HazardsFile | null }) {
  const r = hazards?.reynisfjara;
  if (!r || r.level === "UNKNOWN") return null;
  const msg =
    r.level === "GREEN"
      ? "Lower risk right now — still stay far from the waterline and never turn your back on the sea."
      : r.level === "YELLOW"
        ? "Elevated risk — keep well up the beach, watch every wave."
        : "HIGH danger — sneaker waves are deadly today. Admire from the viewing area only.";
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <span className="h-3.5 w-3.5 rounded-full" style={{ background: r.color }} />
        <p className="text-sm font-semibold text-strong">Reynisfjara beach danger: {r.level}</p>
      </div>
      <p className="mt-1.5 text-sm text-muted">{msg}</p>
      <a href={EXTERNAL.safetravel} target="_blank" rel="noreferrer" className="mt-1.5 inline-block text-xs font-medium text-aurora hover:underline">
        Official conditions (safetravel.is) ↗
      </a>
    </div>
  );
}

const WINTER_CHECKLIST = [
  "Check umferdin.is (road colors) and vedur.is (wind!) every single morning",
  "Plan drives inside the daylight window — it may be only 4–6 hours",
  "Storms close roads with little notice: build a buffer day into any loop",
  "Rental has winter tires by law (Nov–Apr) — confirm anyway",
  "Fuel up at every chance outside the southwest",
  "Download the 112 Iceland app; you can check in before remote stretches",
];

const SUMMER_CHECKLIST = [
  "Hold your car door against gusts — wind-bent doors are Iceland's #1 rental damage",
  "Gravel roads: slow down hard for oncoming cars (flying stones)",
  "One-lane bridges everywhere on Route 1 — closest car has right of way",
  "F-roads require a 4x4 and are ILLEGAL for 2WD rentals; river crossings void insurance",
  "Never drive off-road — it scars the moss for decades and carries heavy fines",
  "Midnight sun wrecks sleep schedules: an eye mask is trip-saving gear",
];

export function ChecklistCard() {
  const { month } = useSeason();
  const winter = month >= 9 || month <= 3;
  const items = winter ? WINTER_CHECKLIST : SUMMER_CHECKLIST;
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-sm font-semibold text-strong">
        Check before you drive — {winter ? "winter" : "summer"} edition
      </p>
      <ul className="mt-2 space-y-1.5 text-sm text-fg">
        {items.map((it) => (
          <li key={it} className="flex gap-2">
            <span className="text-aurora">✓</span> {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FreshnessLine({ updatedAt, linkHref, linkLabel }: { updatedAt: string | null | undefined; linkHref: string; linkLabel: string }) {
  return (
    <p className="text-xs text-muted">
      Updated {formatUpdated(updatedAt)} ·{" "}
      <a href={linkHref} target="_blank" rel="noreferrer" className="font-medium text-aurora hover:underline">
        {linkLabel} ↗
      </a>
    </p>
  );
}

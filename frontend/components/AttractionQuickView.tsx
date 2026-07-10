"use client";

// Quick-view card for an attraction, opened from a planner stop name —
// learn about the place without leaving the itinerary. Bottom sheet on
// phones, centered card on desktop. Esc / backdrop / ✕ to close.

import Link from "next/link";
import { useEffect } from "react";

import { MonthBars } from "@/components/MonthBars";
import { SeasonBadge } from "@/components/SeasonBadge";
import { ExternalIcon } from "@/components/icons";
import { CATEGORY_META } from "@/lib/categories";
import { httpUrl } from "@/lib/format";
import { legUrl } from "@/lib/maps";
import { REGION_NAMES } from "@/lib/types";
import type { Attraction } from "@/lib/types";

const ACCESS_LABEL: Record<string, string> = {
  paved: "Paved road",
  gravel: "Gravel road",
  f_road: "F-road — 4x4, summer only",
  hike: "On foot",
};

export function AttractionQuickView({
  a,
  month,
  onClose,
}: {
  a: Attraction;
  /** The month the badge/chart judge against (the trip day's month). */
  month: number;
  onClose: () => void;
}) {
  // Esc closes; page behind doesn't scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const meta = CATEGORY_META[a.category] ?? CATEGORY_META.other;
  const img = a.photo?.src ?? a.thumbnail ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={a.name}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-canvas shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {img && (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img}
              alt={a.name}
              className="max-h-56 w-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }}
            />
            {a.photo?.credit && (
              <span className="absolute bottom-1 right-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white/80">
                {a.photo.credit}
              </span>
            )}
          </div>
        )}

        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-strong">{a.name}</h3>
              <p className="mt-0.5 text-xs text-muted">
                <span style={{ color: meta.color }}>{meta.label}</span> · {REGION_NAMES[a.region] ?? a.region}
                {a.nameIs && a.nameIs !== a.name && <> · {a.nameIs}</>}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-sm text-muted hover:bg-surface hover:text-fg"
            >
              ✕
            </button>
          </div>

          <div className="mt-2">
            <SeasonBadge item={a} month={month} />
          </div>

          <p className="mt-3 text-sm leading-relaxed text-fg">{a.description}</p>
          {a.extract && a.extract !== a.description && (
            <p className="mt-2 text-sm leading-relaxed text-muted">{a.extract}</p>
          )}
          {a.seasonNote && (
            <p className="mt-3 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-fg">
              <span className="font-medium text-warn">Season note:</span> {a.seasonNote}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {a.access && (
              <span className={a.access === "f_road" ? "font-medium text-warn" : ""}>{ACCESS_LABEL[a.access]}</span>
            )}
            {a.durationMin !== undefined && <span>~{a.durationMin} min visit</span>}
            <span>{a.fee ? (a.feeNote ?? "Paid entry") : "Free"}</span>
          </div>

          <div className="mt-3">
            <MonthBars months={a.months} />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
            <Link
              href={`/place/?id=${encodeURIComponent(a.id)}`}
              className="rounded-lg bg-aurora px-3 py-1.5 text-sm font-semibold text-black hover:bg-aurora-dim"
            >
              Full details →
            </Link>
            <a
              href={legUrl(null, { lat: a.lat, lng: a.lng })}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-ice/40 bg-ice/10 px-3 py-1.5 text-sm font-medium text-ice hover:bg-ice/20"
            >
              Directions <ExternalIcon />
            </a>
            {httpUrl(a.links?.wikipedia) && (
              <a
                href={httpUrl(a.links?.wikipedia)!}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-aurora hover:underline"
              >
                Wikipedia ↗
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

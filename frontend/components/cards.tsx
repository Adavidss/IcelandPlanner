"use client";

// Card components: tours, attractions, routes. All month-aware via SeasonBadge.

import Link from "next/link";

import { AddToTripButton } from "@/components/AddToTripButton";
import { SeasonBadge } from "@/components/SeasonBadge";
import { CATEGORY_META } from "@/lib/categories";
import { formatDuration, formatISK } from "@/lib/format";
import { REGION_NAMES } from "@/lib/types";
import type { Attraction, RouteInfo, Tour } from "@/lib/types";

export function TourCard({ tour, compact = false }: { tour: Tour; compact?: boolean }) {
  return (
    <div className={`group overflow-hidden rounded-xl border border-border bg-surface ${compact ? "w-64 shrink-0 snap-start" : ""}`}>
      <Link href={`/tour/?id=${encodeURIComponent(tour.slug)}`} className="block">
        <div className="relative aspect-video w-full overflow-hidden bg-surface-2">
          {tour.heroImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tour.heroImage}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
          {tour.durationMin !== null && (
            <span className="absolute bottom-2 right-2 rounded-md bg-black/65 px-1.5 py-0.5 text-[11px] font-medium text-white">
              {formatDuration(tour.durationMin)}
            </span>
          )}
        </div>
        <div className="p-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 text-sm font-semibold text-strong group-hover:text-aurora">{tour.title}</h3>
          </div>
          <p className="mt-1 text-xs text-muted">
            {tour.category.slice(0, 2).join(" · ")}
            {tour.priceFromISK !== null && <> · from <span className="font-medium text-fg">{formatISK(tour.priceFromISK)}</span></>}
          </p>
          <div className="mt-2">
            <SeasonBadge item={tour} />
          </div>
        </div>
      </Link>
    </div>
  );
}

export function AttractionCard({ a, compact = false }: { a: Attraction; compact?: boolean }) {
  const meta = CATEGORY_META[a.category] ?? CATEGORY_META.other;
  const img = a.photo?.src ?? a.thumbnail ?? null;
  return (
    <div className={`group overflow-hidden rounded-xl border border-border bg-surface ${compact ? "w-60 shrink-0 snap-start" : ""}`}>
      <Link href={`/place/?id=${encodeURIComponent(a.id)}`} className="block">
        <div className="relative aspect-[3/2] w-full overflow-hidden bg-surface-2">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-4xl" style={{ color: meta.color }}>
              {meta.glyph}
            </div>
          )}
        </div>
        <div className="p-3">
          <h3 className="line-clamp-1 text-sm font-semibold text-strong group-hover:text-aurora">{a.name}</h3>
          <p className="mt-0.5 text-xs text-muted">
            <span style={{ color: meta.color }}>{meta.label}</span> · {REGION_NAMES[a.region] ?? a.region}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <SeasonBadge item={a} />
          </div>
        </div>
      </Link>
      <div className="border-t border-border/60 px-3 py-2">
        <AddToTripButton
          small
          seed={{ kind: "attraction", refId: a.id, name: a.name, lat: a.lat, lng: a.lng, durationMin: a.durationMin }}
        />
      </div>
    </div>
  );
}

export function RouteCard({ route, compact = false }: { route: RouteInfo; compact?: boolean }) {
  return (
    <Link
      href={`/route/?id=${encodeURIComponent(route.id)}`}
      className={`group block overflow-hidden rounded-xl border border-border bg-surface p-4 hover:border-aurora/40 ${compact ? "w-72 shrink-0 snap-start" : ""}`}
    >
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: route.color }} />
        <h3 className="text-sm font-semibold text-strong group-hover:text-aurora">{route.name}</h3>
      </div>
      <p className="mt-2 line-clamp-2 text-xs text-muted">{route.description}</p>
      <p className="mt-2 text-xs text-fg">
        {route.distanceKm} km · ~{Math.round(route.driveMin / 60)} h driving · {route.daysRecommended} day
        {route.daysRecommended > 1 ? "s" : ""}
        {route.loop ? " · loop" : ""}
      </p>
      <div className="mt-2">
        <SeasonBadge item={route} />
      </div>
    </Link>
  );
}

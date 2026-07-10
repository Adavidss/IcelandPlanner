"use client";

// Tour detail (?id=<slug>): gallery, facts, highlights, MonthBars,
// booking CTA → re.is, similar tours.

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { AddToTripButton } from "@/components/AddToTripButton";
import { MonthBars } from "@/components/MonthBars";
import { SeasonBadge } from "@/components/SeasonBadge";
import { TourCard } from "@/components/cards";
import { ExternalIcon } from "@/components/icons";
import { CardRail, EmptyState } from "@/components/ui";
import { getTours } from "@/lib/api";
import { formatDuration, formatISK } from "@/lib/format";
import type { Tour } from "@/lib/types";

function durationBucket(m: number | null): number {
  if (m === null) return -1;
  if (m < 180) return 0;
  if (m < 360) return 1;
  if (m <= 720) return 2;
  return 3;
}

function priceBucket(p: number | null): number {
  if (p === null) return -1;
  if (p < 10_000) return 0;
  if (p < 20_000) return 1;
  if (p < 40_000) return 2;
  return 3;
}

/** ActivityFinder similarGames() port: category +3, month overlap +1, buckets +1 each. */
function similar(all: Tour[], t: Tour): Tour[] {
  return all
    .filter((x) => x.slug !== t.slug)
    .map((x) => {
      let score = 0;
      if (x.category.some((c) => t.category.includes(c))) score += 3;
      if (x.months.some((v, i) => v >= 2 && (t.months[i] ?? 0) >= 2)) score += 1;
      if (durationBucket(x.durationMin) === durationBucket(t.durationMin)) score += 1;
      if (priceBucket(x.priceFromISK) === priceBucket(t.priceFromISK)) score += 1;
      return { x, score };
    })
    .filter(({ score }) => score >= 3)
    .sort((a, b) => b.score - a.score || (a.x.popularIndex ?? 9999) - (b.x.popularIndex ?? 9999))
    .slice(0, 6)
    .map(({ x }) => x);
}

function TourDetail() {
  const params = useSearchParams();
  const slug = params.get("id");
  const [tours, setTours] = useState<Tour[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getTours().then((f) => {
      setTours(f.tours);
      setLoaded(true);
    });
  }, []);

  const tour = useMemo(() => tours.find((t) => t.slug === slug) ?? null, [tours, slug]);
  const rec = useMemo(() => (tour ? similar(tours, tour) : []), [tours, tour]);

  if (!slug) return <EmptyState>No tour selected — <Link href="/tours" className="text-aurora hover:underline">browse tours</Link>.</EmptyState>;
  if (!loaded) return <p className="text-sm text-muted">Loading…</p>;
  if (!tour) return <EmptyState>Tour not found (it may have left the catalog) — <Link href="/tours" className="text-aurora hover:underline">browse current tours</Link>.</EmptyState>;

  const gallery = [tour.heroImage, ...(tour.images ?? [])].filter(Boolean) as string[];

  return (
    <div>
      <Link href="/tours" className="text-sm text-muted hover:text-fg">← All tours</Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-strong">{tour.title}</h1>
          <p className="mt-1 text-sm text-muted">{tour.category.join(" · ")}</p>
        </div>
        <SeasonBadge item={tour} />
      </div>

      {gallery.length > 0 && (
        <div className="-mx-4 mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
          {gallery.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={src}
              alt=""
              loading={i === 0 ? "eager" : "lazy"}
              className="aspect-video w-80 shrink-0 snap-start rounded-xl border border-border object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ))}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[1fr_280px]">
        <div className="min-w-0">
          {tour.summary && <p className="text-sm leading-relaxed text-fg">{tour.summary}</p>}

          {(tour.highlights ?? []).length > 0 && (
            <>
              <h2 className="mt-5 text-sm font-semibold text-strong">Highlights</h2>
              <ul className="mt-2 space-y-1.5 text-sm text-fg">
                {tour.highlights!.map((h) => (
                  <li key={h} className="flex gap-2"><span className="text-aurora">•</span> {h}</li>
                ))}
              </ul>
            </>
          )}

          {(tour.included ?? []).length > 0 && (
            <>
              <h2 className="mt-5 text-sm font-semibold text-strong">Included</h2>
              <ul className="mt-2 space-y-1.5 text-sm text-fg">
                {tour.included!.map((h) => (
                  <li key={h} className="flex gap-2"><span className="text-ice">✓</span> {h}</li>
                ))}
              </ul>
            </>
          )}

          <h2 className="mt-5 text-sm font-semibold text-strong">Best months</h2>
          <div className="mt-2">
            <MonthBars months={tour.months} />
            {tour.seasonNote && <p className="mt-1 text-xs text-muted">Season: {tour.seasonNote}</p>}
          </div>
        </div>

        {/* at-a-glance + CTAs */}
        <div className="h-fit rounded-xl border border-border bg-surface p-4">
          <dl className="space-y-2 text-sm">
            {tour.priceFromISK !== null && (
              <div className="flex justify-between"><dt className="text-muted">From</dt><dd className="font-semibold text-strong">{formatISK(tour.priceFromISK)}</dd></div>
            )}
            {tour.durationMin !== null && (
              <div className="flex justify-between"><dt className="text-muted">Duration</dt><dd className="text-fg">{formatDuration(tour.durationMin)}</dd></div>
            )}
            {tour.difficulty && (
              <div className="flex justify-between"><dt className="text-muted">Difficulty</dt><dd className="text-fg">{tour.difficulty}</dd></div>
            )}
            {tour.minimumAge !== null && tour.minimumAge !== undefined && (
              <div className="flex justify-between"><dt className="text-muted">Min. age</dt><dd className="text-fg">{tour.minimumAge}</dd></div>
            )}
            {tour.departsFrom && (
              <div className="flex justify-between gap-3"><dt className="text-muted">Departs</dt><dd className="text-right text-fg">{tour.departsFrom}</dd></div>
            )}
            {tour.groupSize && (
              <div className="flex justify-between"><dt className="text-muted">Group</dt><dd className="text-fg">{tour.groupSize}</dd></div>
            )}
          </dl>
          <a
            href={tour.bookingUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-aurora px-4 py-2.5 text-sm font-semibold text-black hover:bg-aurora-dim"
          >
            Book on re.is <ExternalIcon />
          </a>
          <div className="mt-2 flex justify-center">
            <AddToTripButton
              seed={{ kind: "tour", refId: tour.slug, name: tour.title, lat: null, lng: null, durationMin: tour.durationMin ?? undefined }}
            />
          </div>
          <p className="mt-3 text-center text-[11px] text-muted">Prices and availability live on re.is — this is a planning view.</p>
        </div>
      </div>

      {rec.length > 0 && (
        <>
          <h2 className="mt-8 text-lg font-semibold text-strong">Similar tours</h2>
          <div className="mt-3">
            <CardRail>{rec.map((t) => <TourCard key={t.id} tour={t} compact />)}</CardRail>
          </div>
        </>
      )}
    </div>
  );
}

export default function TourPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <TourDetail />
    </Suspense>
  );
}

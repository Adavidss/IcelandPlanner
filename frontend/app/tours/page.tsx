"use client";

// Reykjavik Excursions catalog: search, facet chips, month fit, card grid.

import { useEffect, useMemo, useState } from "react";

import { TourCard } from "@/components/cards";
import { SearchIcon } from "@/components/icons";
import { EmptyState, FilterChips } from "@/components/ui";
import { getTours } from "@/lib/api";
import { inSeason, MONTH_SHORT } from "@/lib/season";
import { useSeason } from "@/lib/season-context";
import type { Tour } from "@/lib/types";

type DurationBucket = "short" | "half" | "day" | "multi";
type PriceBucket = "lt10" | "b10_20" | "b20_40" | "gt40";

const DURATIONS: { value: DurationBucket; label: string; test: (m: number) => boolean }[] = [
  { value: "short", label: "< 3 h", test: (m) => m < 180 },
  { value: "half", label: "3–6 h", test: (m) => m >= 180 && m < 360 },
  { value: "day", label: "6–12 h", test: (m) => m >= 360 && m <= 720 },
  { value: "multi", label: "Longer", test: (m) => m > 720 },
];

const PRICES: { value: PriceBucket; label: string; test: (p: number) => boolean }[] = [
  { value: "lt10", label: "< 10k kr.", test: (p) => p < 10_000 },
  { value: "b10_20", label: "10–20k", test: (p) => p >= 10_000 && p < 20_000 },
  { value: "b20_40", label: "20–40k", test: (p) => p >= 20_000 && p < 40_000 },
  { value: "gt40", label: "40k+", test: (p) => p >= 40_000 },
];

function matches(q: string, hay: string): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const h = hay.toLowerCase();
  return words.every((w) => h.includes(w));
}

export default function ToursPage() {
  const { month } = useSeason();
  const [tours, setTours] = useState<Tour[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [duration, setDuration] = useState<DurationBucket | null>(null);
  const [price, setPrice] = useState<PriceBucket | null>(null);
  const [fitMonth, setFitMonth] = useState(true);
  const [sort, setSort] = useState<"popular" | "price" | "duration">("popular");

  useEffect(() => {
    getTours().then((f) => {
      setTours(f.tours);
      setLoaded(true);
    });
  }, []);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tours) for (const c of t.category) counts.set(c, (counts.get(c) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([value]) => ({ value, label: value }));
  }, [tours]);

  const filtered = useMemo(() => {
    let list = tours;
    if (q.trim()) list = list.filter((t) => matches(q, `${t.title} ${t.summary} ${t.category.join(" ")} ${(t.highlights ?? []).join(" ")}`));
    if (category) list = list.filter((t) => t.category.includes(category));
    if (duration) {
      const bucket = DURATIONS.find((d) => d.value === duration)!;
      list = list.filter((t) => t.durationMin !== null && bucket.test(t.durationMin));
    }
    if (price) {
      const bucket = PRICES.find((p) => p.value === price)!;
      list = list.filter((t) => t.priceFromISK !== null && bucket.test(t.priceFromISK));
    }
    if (fitMonth) list = list.filter((t) => inSeason(t, month));
    switch (sort) {
      case "price":
        return [...list].sort((a, b) => (a.priceFromISK ?? Infinity) - (b.priceFromISK ?? Infinity));
      case "duration":
        return [...list].sort((a, b) => (a.durationMin ?? Infinity) - (b.durationMin ?? Infinity));
      default:
        return [...list].sort((a, b) => (a.popularIndex ?? 9999) - (b.popularIndex ?? 9999));
    }
  }, [tours, q, category, duration, price, fitMonth, sort, month]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-strong">Day tours</h1>
          <p className="mt-1 text-sm text-muted">
            {tours.length} tours from Reykjavik Excursions — booking happens on re.is.
          </p>
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-fg"
        >
          <option value="popular">Most popular</option>
          <option value="price">Cheapest first</option>
          <option value="duration">Shortest first</option>
        </select>
      </div>

      <div className="relative mt-3">
        <SearchIcon size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search tours — glacier, whale, northern lights…"
          className="w-full rounded-xl border border-border bg-surface py-2 pl-9 pr-3 text-sm text-fg placeholder:text-muted focus:border-aurora/50"
        />
      </div>

      <div className="mt-2 space-y-1.5">
        <FilterChips options={categories} value={category} onChange={setCategory} />
        <div className="flex flex-wrap items-center gap-2">
          <FilterChips options={DURATIONS.map(({ value, label }) => ({ value, label }))} value={duration} onChange={setDuration} allLabel="Any length" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterChips options={PRICES.map(({ value, label }) => ({ value, label }))} value={price} onChange={setPrice} allLabel="Any price" />
          <button
            onClick={() => setFitMonth((v) => !v)}
            className={`shrink-0 rounded-full border px-3 py-1 text-sm ${
              fitMonth ? "border-aurora/50 bg-aurora/15 font-medium text-strong" : "border-border bg-surface text-muted"
            }`}
          >
            Fits {MONTH_SHORT[month]}
          </button>
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <TourCard key={t.slug} tour={t} />
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <EmptyState>
            {loaded && tours.length === 0
              ? "Tour data loads after the first data build — run npm run data:build."
              : "No tours match those filters — try loosening them."}
          </EmptyState>
        </div>
      )}
    </div>
  );
}

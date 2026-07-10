"use client";

// Small shared UI: titled sections, empty states, horizontal snap rails,
// and single-select filter chip rows.

import Link from "next/link";

export function Section({
  title,
  blurb,
  seeAll,
  children,
}: {
  title: string;
  blurb?: string;
  seeAll?: { href: string; label?: string };
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-strong">{title}</h2>
          {blurb && <p className="mt-0.5 text-sm text-muted">{blurb}</p>}
        </div>
        {seeAll && (
          <Link href={seeAll.href} className="shrink-0 text-sm font-medium text-aurora hover:underline">
            {seeAll.label ?? "See all"} →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
      {children}
    </div>
  );
}

/** Horizontal snap-scroll rail for cards. */
export function CardRail({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:thin]">
      {children}
    </div>
  );
}

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  allLabel = "All",
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T | null) => void;
  allLabel?: string | null;
}) {
  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-3 py-1 text-sm transition-colors ${
      active
        ? "border-aurora/50 bg-aurora/15 font-medium text-strong"
        : "border-border bg-surface text-muted hover:bg-surface-2 hover:text-fg"
    }`;
  return (
    <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none]">
      {allLabel !== null && (
        <button className={chip(value === null)} onClick={() => onChange(null)}>
          {allLabel}
        </button>
      )}
      {options.map((o) => (
        <button key={o.value} className={chip(value === o.value)} onClick={() => onChange(o.value === value ? null : o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

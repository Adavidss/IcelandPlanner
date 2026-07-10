"use client";

// The global "when are you going?" chip in the nav — opens a 12-month grid.
// Drives every season badge, warning and discovery row via useSeason().

import { useEffect, useRef, useState } from "react";

import { CalendarIcon } from "@/components/icons";
import { MONTH_SHORT } from "@/lib/season";
import { useSeason } from "@/lib/season-context";

export function MonthPicker() {
  const { month, source, setMonth, ready } = useSeason();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const label = !ready
    ? "…"
    : source === "today"
      ? `Now: ${MONTH_SHORT[month]}`
      : source === "trip"
        ? `Trip: ${MONTH_SHORT[month]}`
        : `Traveling: ${MONTH_SHORT[month]}`;

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm ${
          source === "picked"
            ? "border-aurora/50 bg-aurora/15 font-medium text-strong"
            : "border-border bg-surface text-fg hover:bg-surface-2"
        }`}
        aria-label="Choose your travel month"
      >
        <CalendarIcon size={14} className={source === "picked" ? "text-aurora" : "text-muted"} />
        {label}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-64 rounded-xl border border-border bg-canvas p-3 shadow-xl">
          <p className="mb-2 text-xs text-muted">
            When are you going? Badges, warnings and daylight adapt to your month.
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {MONTH_SHORT.map((m, i) => (
              <button
                key={m}
                onClick={() => {
                  setMonth(i);
                  setOpen(false);
                }}
                className={`rounded-lg px-2 py-1.5 text-sm ${
                  i === month && source !== "today"
                    ? "bg-aurora/20 font-semibold text-strong ring-1 ring-aurora/50"
                    : i === new Date().getMonth()
                      ? "bg-surface-2 text-fg"
                      : "bg-surface text-muted hover:bg-surface-2 hover:text-fg"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          {source === "picked" && (
            <button
              onClick={() => {
                setMonth(null);
                setOpen(false);
              }}
              className="mt-2 w-full rounded-lg border border-border px-2 py-1.5 text-xs text-muted hover:bg-surface"
            >
              Reset to today ({MONTH_SHORT[new Date().getMonth()]})
            </button>
          )}
        </div>
      )}
    </div>
  );
}

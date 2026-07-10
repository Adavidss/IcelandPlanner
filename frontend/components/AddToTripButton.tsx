"use client";

// The add-to-itinerary flow on every card/detail/popup: no trip → silently
// creates one; multi-day trip → a day popover; feedback = the button itself
// flips to "Added — Day N" for 2 s.

import { useEffect, useRef, useState } from "react";

import { CheckIcon, PlusIcon } from "@/components/icons";
import { useTrip } from "@/lib/trip";
import type { TripStopSeed } from "@/lib/types";

export function AddToTripButton({
  seed,
  small = false,
  className = "",
}: {
  seed: TripStopSeed;
  small?: boolean;
  className?: string;
}) {
  const { activeTrip, addStop, ready } = useTrip();
  const [added, setAdded] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  useEffect(() => {
    if (!pickerOpen) return;
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [pickerOpen]);

  if (!ready) return null;

  const doAdd = (dayIndex: number | "last") => {
    const [, idx] = addStop(seed, dayIndex);
    setPickerOpen(false);
    setAdded(`Added — Day ${idx + 1}`);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setAdded(null), 2000);
  };

  const base = small
    ? "rounded-lg px-2.5 py-1 text-xs"
    : "rounded-lg px-3 py-1.5 text-sm";

  if (added) {
    return (
      <span className={`inline-flex items-center gap-1 ${base} bg-aurora/15 font-medium text-aurora ${className}`}>
        <CheckIcon size={small ? 12 : 14} /> {added}
      </span>
    );
  }

  const multiDay = (activeTrip?.days.length ?? 0) > 1;

  return (
    <div className={`relative inline-block ${className}`} ref={boxRef}>
      <button
        onClick={() => (multiDay ? setPickerOpen((v) => !v) : doAdd("last"))}
        className={`inline-flex items-center gap-1 ${base} border border-aurora/40 bg-aurora/10 font-medium text-aurora hover:bg-aurora/20`}
      >
        <PlusIcon size={small ? 12 : 14} /> Add to trip
      </button>
      {pickerOpen && activeTrip && (
        <div className="absolute bottom-full left-0 z-30 mb-1 max-h-56 w-44 overflow-y-auto rounded-lg border border-border bg-canvas p-1 shadow-xl">
          {activeTrip.days.map((d, i) => (
            <button
              key={d.id}
              onClick={() => doAdd(i)}
              className="block w-full rounded px-2 py-1.5 text-left text-sm text-fg hover:bg-surface"
            >
              Day {i + 1}
              {d.note && <span className="ml-1 text-xs text-muted">· {d.note.slice(0, 18)}</span>}
              <span className="ml-1 text-xs text-muted">({d.stops.length})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

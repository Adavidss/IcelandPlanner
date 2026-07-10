"use client";

// Global "when are you traveling" state — the month every badge, warning,
// discovery row and daylight calculation keys off. Defaults to today;
// settable from the nav MonthPicker or (via source:"trip") the active trip.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { storeGet, storeRemove, storeSet } from "./store";

interface SeasonState {
  /** 0–11 (Jan = 0). */
  month: number;
  source: "today" | "picked" | "trip";
  /** Representative date: today when month is the current one, else the 15th. */
  date: Date;
  setMonth: (m: number | null) => void; // null = back to "today"
  /** Trip provider pushes the trip's month here (won't override a user pick). */
  setTripMonth: (m: number | null) => void;
  ready: boolean;
}

const Ctx = createContext<SeasonState>({
  month: new Date().getMonth(),
  source: "today",
  date: new Date(),
  setMonth: () => {},
  setTripMonth: () => {},
  ready: false,
});

function representativeDate(month: number): Date {
  const now = new Date();
  if (month === now.getMonth()) return now;
  // Next occurrence of that month, on the 15th (zone-safe: constructed, not parsed).
  const year = month < now.getMonth() ? now.getFullYear() + 1 : now.getFullYear();
  return new Date(year, month, 15, 12, 0, 0);
}

export function SeasonProvider({ children }: { children: React.ReactNode }) {
  const [picked, setPicked] = useState<number | null>(null);
  const [tripMonth, setTripMonthState] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = storeGet<number | null>("month.v1", null);
    if (typeof saved === "number" && saved >= 0 && saved <= 11) setPicked(saved);
    setReady(true);
  }, []);

  const setMonth = useCallback((m: number | null) => {
    setPicked(m);
    if (m === null) storeRemove("month.v1");
    else storeSet("month.v1", m);
  }, []);

  const setTripMonth = useCallback((m: number | null) => {
    setTripMonthState(m);
  }, []);

  const value = useMemo<SeasonState>(() => {
    const now = new Date();
    const month = picked ?? tripMonth ?? now.getMonth();
    const source: SeasonState["source"] = picked !== null ? "picked" : tripMonth !== null ? "trip" : "today";
    return { month, source, date: representativeDate(month), setMonth, setTripMonth, ready };
  }, [picked, tripMonth, setMonth, setTripMonth, ready]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSeason(): SeasonState {
  return useContext(Ctx);
}

"use client";

// The itinerary store: multiple named trips in localStorage (ip.trips.v1),
// day-by-day, write-through persistence. CRUD model ported from
// ActivityFinder's mygames.js (normalize / slugify+collision / import-export).

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useSeason } from "./season-context";
import { storeGet, storeSet } from "./store";
import type { Trip, TripDay, TripStop, TripStopSeed } from "./types";

const TRIPS_KEY = "trips.v1";
const ACTIVE_KEY = "activeTrip.v1";

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

let uidCounter = 0;
const uid = () => `s${Date.now().toString(36)}${(uidCounter++).toString(36)}`;

function slugify(name: string, taken: Set<string>): string {
  const base =
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "trip";
  let id = base;
  let n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  return id;
}

function normalizeStop(s: Partial<TripStop>): TripStop | null {
  if (!s || !s.name) return null;
  return {
    id: s.id || uid(),
    kind: (["attraction", "tour", "poi", "route", "custom"] as const).includes(s.kind as never)
      ? (s.kind as TripStop["kind"])
      : "custom",
    refId: s.refId ?? null,
    name: String(s.name),
    lat: Number.isFinite(s.lat) ? (s.lat as number) : null,
    lng: Number.isFinite(s.lng) ? (s.lng as number) : null,
    durationMin: Number.isFinite(s.durationMin) ? s.durationMin : undefined,
    note: typeof s.note === "string" && s.note ? s.note : undefined,
  };
}

function normalizeTrip(t: Partial<Trip>): Trip | null {
  if (!t || !t.id || !t.name) return null;
  const days: TripDay[] = (Array.isArray(t.days) ? t.days : []).map((d) => ({
    id: d?.id || uid(),
    note: typeof d?.note === "string" ? d.note : "",
    stops: (Array.isArray(d?.stops) ? d.stops : [])
      .map(normalizeStop)
      .filter((s): s is TripStop => s !== null),
  }));
  if (days.length === 0) days.push({ id: uid(), note: "", stops: [] });
  return {
    id: t.id,
    name: t.name,
    startDate: typeof t.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.startDate) ? t.startDate : null,
    days,
    created: t.created ?? todayISO(),
    updated: t.updated ?? todayISO(),
  };
}

function loadTrips(): Trip[] {
  const raw = storeGet<unknown>(TRIPS_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw.map((t) => normalizeTrip(t as Partial<Trip>)).filter((t): t is Trip => t !== null);
}

/** startDate + dayIndex → zone-safe Date (constructed from numbers, never parsed). */
export function dateForDay(trip: Trip, dayIndex: number): Date | null {
  if (!trip.startDate) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trip.startDate);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  d.setDate(d.getDate() + dayIndex);
  return d;
}

interface TripState {
  trips: Trip[];
  activeTrip: Trip | null;
  ready: boolean;
  createTrip: (name: string, startDate?: string | null) => string;
  renameTrip: (id: string, name: string) => void;
  deleteTrip: (id: string) => void;
  setActive: (id: string | null) => void;
  setStartDate: (id: string, date: string | null) => void;
  addDay: (tripId: string) => void;
  removeDay: (tripId: string, dayIndex: number) => void;
  setDayNote: (tripId: string, dayIndex: number, note: string) => void;
  /** dayIndex "last" = final day; creates a default trip when none exists. Returns [tripName, dayIndex]. */
  addStop: (seed: TripStopSeed, dayIndex?: number | "last") => [string, number];
  /** Atomically append a whole route: new days split on dayBreaks (stop indexes
   *  that begin a new day). Creates/activates a trip when none exists. */
  bulkAdd: (name: string, seeds: TripStopSeed[], dayBreaks: number[]) => void;
  /** Create a brand-new trip from pre-built days (preset trips) and activate it. */
  createTripFromDays: (name: string, days: { note: string; seeds: TripStopSeed[] }[]) => string;
  removeStop: (tripId: string, dayIndex: number, stopId: string) => void;
  moveStop: (tripId: string, dayIndex: number, stopIndex: number, delta: -1 | 1) => void;
  moveStopToDay: (tripId: string, fromDay: number, stopId: string, toDay: number) => void;
  setStopField: (tripId: string, dayIndex: number, stopId: string, patch: Partial<Pick<TripStop, "durationMin" | "note">>) => void;
  importTrips: (json: string) => { added: number; error?: string };
  exportTrips: () => string;
}

const Ctx = createContext<TripState | null>(null);

export function TripProvider({ children }: { children: React.ReactNode }) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const { setTripMonth } = useSeason();

  useEffect(() => {
    const t = loadTrips();
    setTrips(t);
    const savedActive = storeGet<string | null>(ACTIVE_KEY, null);
    setActiveId(t.some((x) => x.id === savedActive) ? savedActive : (t[0]?.id ?? null));
    setReady(true);
  }, []);

  // Persist + surface the active trip's month to the season context.
  const activeTrip = useMemo(() => trips.find((t) => t.id === activeId) ?? null, [trips, activeId]);
  useEffect(() => {
    if (!ready) return;
    if (activeTrip?.startDate) {
      const m = /^(\d{4})-(\d{2})/.exec(activeTrip.startDate);
      setTripMonth(m ? Number(m[2]) - 1 : null);
    } else {
      setTripMonth(null);
    }
  }, [activeTrip, ready, setTripMonth]);

  const mutate = useCallback((fn: (trips: Trip[]) => Trip[]) => {
    setTrips((prev) => {
      const next = fn(prev).map((t) => ({ ...t, updated: todayISO() }));
      storeSet(TRIPS_KEY, next);
      return next;
    });
  }, []);

  const patchTrip = useCallback(
    (id: string, fn: (t: Trip) => Trip) => {
      mutate((prev) => prev.map((t) => (t.id === id ? fn(t) : t)));
    },
    [mutate],
  );

  const setActive = useCallback((id: string | null) => {
    setActiveId(id);
    storeSet(ACTIVE_KEY, id);
  }, []);

  const createTrip = useCallback(
    (name: string, startDate: string | null = null): string => {
      const id = slugify(name, new Set(trips.map((t) => t.id)));
      const trip: Trip = {
        id,
        name,
        startDate,
        days: [{ id: uid(), note: "", stops: [] }],
        created: todayISO(),
        updated: todayISO(),
      };
      mutate((prev) => [...prev, trip]);
      setActive(id);
      return id;
    },
    [trips, mutate, setActive],
  );

  const value = useMemo<TripState>(
    () => ({
      trips,
      activeTrip,
      ready,
      createTrip,
      renameTrip: (id, name) => patchTrip(id, (t) => ({ ...t, name })),
      deleteTrip: (id) => {
        mutate((prev) => prev.filter((t) => t.id !== id));
        if (activeId === id) setActive(trips.find((t) => t.id !== id)?.id ?? null);
      },
      setActive,
      setStartDate: (id, date) => patchTrip(id, (t) => ({ ...t, startDate: date })),
      addDay: (tripId) => patchTrip(tripId, (t) => ({ ...t, days: [...t.days, { id: uid(), note: "", stops: [] }] })),
      removeDay: (tripId, dayIndex) =>
        patchTrip(tripId, (t) => {
          if (t.days.length <= 1) return t; // always keep one day
          return { ...t, days: t.days.filter((_, i) => i !== dayIndex) };
        }),
      setDayNote: (tripId, dayIndex, note) =>
        patchTrip(tripId, (t) => ({
          ...t,
          days: t.days.map((d, i) => (i === dayIndex ? { ...d, note } : d)),
        })),
      addStop: (seed, dayIndex = "last") => {
        let targetTrip = activeTrip;
        if (!targetTrip) {
          // Silently create a first trip — the zero-friction path.
          const id = slugify("My Iceland trip", new Set(trips.map((t) => t.id)));
          targetTrip = {
            id,
            name: "My Iceland trip",
            startDate: null,
            days: [{ id: uid(), note: "", stops: [] }],
            created: todayISO(),
            updated: todayISO(),
          };
          const stop = normalizeStop({ ...seed, id: uid() });
          if (stop) targetTrip.days[0].stops.push(stop);
          const finalTrip = targetTrip;
          mutate((prev) => [...prev, finalTrip]);
          setActive(id);
          return [finalTrip.name, 0];
        }
        const idx = dayIndex === "last" ? targetTrip.days.length - 1 : Math.min(dayIndex, targetTrip.days.length - 1);
        const stop = normalizeStop({ ...seed, id: uid() });
        if (stop) {
          patchTrip(targetTrip.id, (t) => ({
            ...t,
            days: t.days.map((d, i) => (i === idx ? { ...d, stops: [...d.stops, stop] } : d)),
          }));
        }
        return [targetTrip.name, idx];
      },
      createTripFromDays: (name, dayDefs) => {
        const id = slugify(name, new Set(trips.map((t) => t.id)));
        const trip: Trip = {
          id,
          name,
          startDate: null,
          days: dayDefs.map((d) => ({
            id: uid(),
            note: d.note,
            stops: d.seeds
              .map((seed) => normalizeStop({ ...seed, id: uid() }))
              .filter((s): s is TripStop => s !== null),
          })),
          created: todayISO(),
          updated: todayISO(),
        };
        if (trip.days.length === 0) trip.days.push({ id: uid(), note: "", stops: [] });
        mutate((prev) => [...prev, trip]);
        setActive(id);
        return id;
      },
      bulkAdd: (name, seeds, dayBreaks) => {
        const breaks = new Set(dayBreaks);
        // Build the day groups once; apply in a single functional update.
        const groups: TripStop[][] = [[]];
        seeds.forEach((seed, i) => {
          if (i > 0 && breaks.has(i)) groups.push([]);
          const stop = normalizeStop({ ...seed, id: uid() });
          if (stop) groups[groups.length - 1].push(stop);
        });
        const newDays = (): TripDay[] => groups.map((stops) => ({ id: uid(), note: "", stops }));
        if (activeTrip) {
          patchTrip(activeTrip.id, (t) => {
            // Append into the last day if it's empty, else add fresh days.
            const days = [...t.days];
            const fresh = newDays();
            if (days.length === 1 && days[0].stops.length === 0) return { ...t, days: fresh };
            return { ...t, days: [...days, ...fresh] };
          });
        } else {
          const id = slugify(name, new Set(trips.map((t) => t.id)));
          const trip: Trip = {
            id,
            name,
            startDate: null,
            days: newDays(),
            created: todayISO(),
            updated: todayISO(),
          };
          mutate((prev) => [...prev, trip]);
          setActive(id);
        }
      },
      removeStop: (tripId, dayIndex, stopId) =>
        patchTrip(tripId, (t) => ({
          ...t,
          days: t.days.map((d, i) => (i === dayIndex ? { ...d, stops: d.stops.filter((s) => s.id !== stopId) } : d)),
        })),
      moveStop: (tripId, dayIndex, stopIndex, delta) =>
        patchTrip(tripId, (t) => ({
          ...t,
          days: t.days.map((d, i) => {
            if (i !== dayIndex) return d;
            const j = stopIndex + delta;
            if (j < 0 || j >= d.stops.length) return d;
            const stops = [...d.stops];
            [stops[stopIndex], stops[j]] = [stops[j], stops[stopIndex]];
            return { ...d, stops };
          }),
        })),
      moveStopToDay: (tripId, fromDay, stopId, toDay) =>
        patchTrip(tripId, (t) => {
          if (toDay < 0 || toDay >= t.days.length || toDay === fromDay) return t;
          const stop = t.days[fromDay]?.stops.find((s) => s.id === stopId);
          if (!stop) return t;
          return {
            ...t,
            days: t.days.map((d, i) => {
              if (i === fromDay) return { ...d, stops: d.stops.filter((s) => s.id !== stopId) };
              if (i === toDay) return { ...d, stops: [...d.stops, stop] };
              return d;
            }),
          };
        }),
      setStopField: (tripId, dayIndex, stopId, patch) =>
        patchTrip(tripId, (t) => ({
          ...t,
          days: t.days.map((d, i) =>
            i === dayIndex
              ? { ...d, stops: d.stops.map((s) => (s.id === stopId ? { ...s, ...patch } : s)) }
              : d,
          ),
        })),
      importTrips: (json) => {
        try {
          const incoming = JSON.parse(json);
          if (!Array.isArray(incoming)) return { added: 0, error: "Expected a JSON array of trips" };
          const taken = new Set(trips.map((t) => t.id));
          let added = 0;
          const cleaned: Trip[] = [];
          for (const raw of incoming) {
            const t = normalizeTrip(raw);
            if (!t) continue;
            if (taken.has(t.id)) t.id = slugify(t.name, taken);
            taken.add(t.id);
            cleaned.push(t);
            added++;
          }
          if (added > 0) mutate((prev) => [...prev, ...cleaned]);
          return { added };
        } catch {
          return { added: 0, error: "Couldn't parse that file — expected a JSON export from this page." };
        }
      },
      exportTrips: () => JSON.stringify(trips, null, 2),
    }),
    [trips, activeTrip, ready, activeId, createTrip, mutate, patchTrip, setActive],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTrip(): TripState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTrip outside TripProvider");
  return v;
}

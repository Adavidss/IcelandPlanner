"use client";

// The classic driving routes as cards.

import { useEffect, useState } from "react";

import { RouteCard } from "@/components/cards";
import { EmptyState } from "@/components/ui";
import { getRoutes } from "@/lib/api";
import type { RouteInfo } from "@/lib/types";

export default function RoutesPage() {
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getRoutes().then((f) => {
      setRoutes(f.routes);
      setLoaded(true);
    });
  }, []);

  return (
    <div>
      <h1 className="text-xl font-bold text-strong">Driving routes</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Iceland organizes itself into a handful of legendary drives. Each one is clickable — stops, drive
        times, directions, and a one-tap way to drop the whole route into your trip.
      </p>
      {routes.length > 0 ? (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {routes.map((r) => (
            <RouteCard key={r.id} route={r} />
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <EmptyState>{loaded ? "Route data loads after the first data build." : "Loading…"}</EmptyState>
        </div>
      )}
    </div>
  );
}

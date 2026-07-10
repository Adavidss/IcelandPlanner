# IcelandPlanner

Plan and discover an Iceland trip — interactive map, Reykjavik Excursions tours,
restaurants/fuel/pools/lodging, the classic driving routes, live-ish road
conditions, and a day-by-day itinerary builder that understands Iceland's
seasons (21-hour summer days, 4-hour winter days, aurora vs midnight sun,
F-road closures).

**Live site:** https://www.kidsdc.org/IcelandPlanner/

Fully static: a Next.js export on GitHub Pages reading pre-built JSON. No
backend, no accounts — trips live in localStorage (JSON export/import built in).

## Architecture — three data planes

```
TIER 1 — baked daily (deploy.yml)
  re.is tours + committed caches (POI / wiki) + data/curated/*
  → scripts/build-all.mjs → frontend/public/data/*.json (gitignored)
  → next build → Pages artifact

WEEKLY (weekly-data.yml)
  Overpass POIs + Wikipedia/Wikidata harvest + re.is snapshot
  → committed to data/cache/ on main (permanent last-good fallback;
    deploys never hit Overpass/Wikidata directly)

TIER 2 — live-ish every 30 min (live-data.yml)
  road conditions (Vegagerðin) + weather forecasts (Veður) + hazards (SafeTravel)
  → orphan `data` branch, ONE amended commit force-pushed (no history growth)
  → the site fetches raw.githubusercontent.com/Adavidss/IcelandPlanner/data/…
    client-side (CORS *); status.json is the freshness heartbeat

CLIENT-DIRECT (no CI)
  NOAA space-weather Kp (aurora) · SafeTravel alerts · SunCalc daylight
```

## Repo map

- `frontend/` — Next.js 15 static export (`basePath /IcelandPlanner`)
- `scripts/` — zero-dependency Node data scripts (`npm run data:build` etc.)
- `data/curated/` — hand-authored attractions (with per-month 0–3 season
  scores), the 7 driving routes + GeoJSON geometry, weather-station registry.
  **Edit these freely** — `scripts/build-curated.mjs` validates on every push.
- `data/cache/` — machine-written weekly snapshots. Don't edit by hand.

## Local development

```bash
cd frontend && npm install && cd ..
npm run data:build        # fetch tours + copy caches/curated → frontend/public/data
npm --prefix frontend run dev -- -p 3030   # http://localhost:3030/IcelandPlanner/
```

`npm run data:offline` builds from committed caches only (what CI runs on PRs).
`npm run data:live` writes tier-2 files to `.live-preview/` for inspection.

## Deploy

Pushes to `main` touching `frontend/ scripts/ data/` (or the daily cron) run
`deploy.yml` → GitHub Pages (repo Settings → Pages → Source = **GitHub
Actions**). No secrets required anywhere.

## Data credits

Tours: [Reykjavik Excursions](https://www.re.is) · POIs: OpenStreetMap
contributors (Overpass) · Roads: [Vegagerðin](https://umferdin.is) · Weather:
[Veðurstofa Íslands](https://en.vedur.is) · Hazards/alerts:
[SafeTravel](https://safetravel.is) · Aurora: NOAA SWPC · Extended places:
Wikipedia/Wikidata · Tiles: OpenStreetMap © CARTO

/** @type {import('next').NextConfig} */

// GitHub Pages PROJECT site served from a fixed subpath:
//   https://www.kidsdc.org/IcelandPlanner/
// Everything keys off this constant:
//   - basePath/assetPrefix prefix Next's <Link>, router, and /_next assets
//   - env.NEXT_PUBLIC_BASE_PATH lets hand-built URLs (the /data/*.json fetches
//     in lib/api.ts, raw-HTML popup links in IcelandMap) resolve under it too.
const basePath = "/IcelandPlanner";

const nextConfig = {
  // Static HTML export to ./out — no server (GitHub Pages serves files only).
  output: "export",
  reactStrictMode: true,
  basePath,
  assetPrefix: `${basePath}/`,
  // Pages serves /route/ -> /route/index.html; trailing slashes make that work.
  trailingSlash: true,
  // No Image Optimization server exists for a static export.
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    // Tier-2 live data: the orphan `data` branch via raw.githubusercontent
    // (serves Access-Control-Allow-Origin: *). Override locally to test.
    NEXT_PUBLIC_LIVE_DATA_BASE:
      process.env.NEXT_PUBLIC_LIVE_DATA_BASE ??
      "https://raw.githubusercontent.com/Adavidss/IcelandPlanner/data",
  },
};

export default nextConfig;

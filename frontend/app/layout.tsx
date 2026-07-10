import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { MobileTabBar } from "@/components/MobileTabBar";
import { Nav } from "@/components/Nav";
import { SeasonProvider } from "@/lib/season-context";
import { TripProvider } from "@/lib/trip";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

// Icons are hand-prefixed with the basePath — metadata icon URLs don't get it
// automatically in a static export.
const BASE = "/IcelandPlanner";

export const metadata: Metadata = {
  title: "IcelandPlanner",
  description:
    "Plan and discover an Iceland trip — interactive map, tours, driving routes, live road conditions, and a season-aware itinerary builder.",
  icons: {
    icon: `${BASE}/icon.png`,
    apple: `${BASE}/apple-touch-icon.png`,
  },
  appleWebApp: {
    capable: true,
    title: "IcelandPlanner",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0b",
};

// Set the theme class before first paint to avoid a flash. Dark by default
// unless the user explicitly chose light.
const themeScript = `(function(){try{var t=localStorage.getItem('ip.theme');if(t!=='light'){document.documentElement.classList.add('dark');}}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <SeasonProvider>
          <TripProvider>
            <Nav />
            <main className="mx-auto max-w-5xl px-4 pb-24 pt-5 md:py-8">{children}</main>
            <footer className="no-print mx-auto max-w-5xl border-t border-border px-4 py-6 pb-[max(5.5rem,env(safe-area-inset-bottom))] text-xs text-muted md:pb-6">
              <p>
                Data: tours from{" "}
                <a href="https://www.re.is" className="underline hover:text-fg" target="_blank" rel="noreferrer">Reykjavik Excursions</a>
                {" · "}places © OpenStreetMap contributors{" · "}roads{" "}
                <a href="https://umferdin.is/en" className="underline hover:text-fg" target="_blank" rel="noreferrer">Vegagerðin</a>
                {" · "}weather{" "}
                <a href="https://en.vedur.is" className="underline hover:text-fg" target="_blank" rel="noreferrer">Veðurstofa Íslands</a>
                {" · "}alerts{" "}
                <a href="https://safetravel.is" className="underline hover:text-fg" target="_blank" rel="noreferrer">SafeTravel</a>
                {" · "}aurora NOAA SWPC{" · "}extended places Wikipedia{" · "}tiles © OpenStreetMap © CARTO.
              </p>
              <p className="mt-1">
                Estimates only — always check <a href="https://umferdin.is/en" className="underline hover:text-fg" target="_blank" rel="noreferrer">umferdin.is</a> and{" "}
                <a href="https://safetravel.is" className="underline hover:text-fg" target="_blank" rel="noreferrer">safetravel.is</a> before driving.
              </p>
            </footer>
            <MobileTabBar />
          </TripProvider>
        </SeasonProvider>
      </body>
    </html>
  );
}

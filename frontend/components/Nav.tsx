"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { MonthPicker } from "@/components/MonthPicker";
import { CompassIcon, MoonIcon, SunIcon } from "@/components/icons";

const LINKS: { href: string; label: string; also?: string[] }[] = [
  { href: "/map", label: "Map", also: ["/place"] },
  { href: "/tours", label: "Tours", also: ["/tour"] },
  { href: "/routes", label: "Routes", also: ["/route"] },
  { href: "/plan", label: "Plan" },
  { href: "/safety", label: "Safety" },
];

function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [dark, setDark] = useState(true);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = useCallback(() => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("ip.theme", next ? "dark" : "light");
    } catch {
      // private mode — theme just won't persist
    }
    setDark(next);
  }, []);

  return (
    <button
      onClick={toggle}
      aria-label="Toggle light/dark theme"
      className="shrink-0 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm hover:bg-surface-2"
    >
      {mounted ? (dark ? <SunIcon /> : <MoonIcon />) : <span className="inline-block w-4" />}
    </button>
  );
}

export function Nav() {
  const pathname = usePathname() ?? "/";
  const current = pathname !== "/" ? pathname.replace(/\/$/, "") : "/";

  return (
    <header className="no-print sticky top-0 z-20 border-b border-border bg-canvas/85 pt-[env(safe-area-inset-top)] backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-5xl items-center gap-1 px-4 sm:gap-1.5">
        <Link href="/" className="mr-2 flex items-center gap-1.5 font-semibold text-strong">
          <CompassIcon size={19} className="text-aurora" />
          <span className="hidden md:inline">IcelandPlanner</span>
        </Link>
        <div className="hidden items-center gap-1 sm:flex">
          {LINKS.map(({ href, label, also }) => {
            const active = current === href || (also ?? []).some((a) => current.startsWith(a));
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-lg px-2.5 py-1.5 text-sm ${
                  active ? "bg-surface-2 font-medium text-strong" : "text-muted hover:bg-surface hover:text-fg"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <MonthPicker />
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { CalendarIcon, HomeIcon, MapIcon, ShieldIcon, TicketIcon } from "@/components/icons";

const TABS = [
  { href: "/", label: "Home", icon: HomeIcon, also: [] as string[] },
  { href: "/map", label: "Map", icon: MapIcon, also: ["/place"] },
  { href: "/tours", label: "Tours", icon: TicketIcon, also: ["/tour"] },
  { href: "/plan", label: "Plan", icon: CalendarIcon, also: [] as string[] },
  { href: "/safety", label: "Safety", icon: ShieldIcon, also: [] as string[] },
];

export function MobileTabBar() {
  const pathname = usePathname() ?? "/";
  const current = pathname !== "/" ? pathname.replace(/\/$/, "") : "/";

  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-20 border-t border-border bg-canvas/90 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5">
        {TABS.map(({ href, label, icon: Icon, also }) => {
          const active = current === href || also.some((a) => current.startsWith(a));
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${
                active ? "font-medium text-aurora" : "text-muted"
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

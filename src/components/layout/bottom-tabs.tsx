"use client";

import { Home, Search, Plus, Calendar, Video } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Accueil", icon: Home, href: "/" },
  { label: "Recherche", icon: Search, href: "/search" },
  { label: "Nouveau", icon: Plus, href: "/new" },
  { label: "Calendrier", icon: Calendar, href: "/calendar" },
  { label: "Réunion", icon: Video, href: "/meet" },
] as const;

export function BottomTabs() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around h-16 bg-background/95 backdrop-blur-sm border-t border-border md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {tabs.map(({ label, icon: Icon, href }) => {
        const isActive =
          href === "/"
            ? pathname === "/"
            : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${
              isActive
                ? "text-[var(--color-loriax-coral)] border-t-2 border-[var(--color-loriax-coral)]"
                : "text-muted-foreground"
            }`}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] leading-none">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import {
  Home,
  Search,
  Network,
  Sparkles,
  CalendarDays,
  Video,
  Shield,
  Building2,
} from "lucide-react";

interface QuickNavProps {
  pathname: string;
  user: {
    globalRole?: string;
  } | null;
}

export function QuickNav({ pathname, user }: QuickNavProps) {
  return (
    <nav className="px-3 py-2 space-y-1">
      <Link
        href="/"
        className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
          pathname === "/"
            ? "bg-sidebar-accent font-medium"
            : "hover:bg-sidebar-accent"
        }`}
      >
        <Home className="h-4 w-4" />
        Accueil
      </Link>
      <Link
        href="/search"
        className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
          pathname === "/search"
            ? "bg-sidebar-accent font-medium"
            : "hover:bg-sidebar-accent"
        }`}
      >
        <Search className="h-4 w-4" />
        Rechercher
      </Link>
      <Link
        href="/graph"
        className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
          pathname === "/graph"
            ? "bg-sidebar-accent font-medium"
            : "hover:bg-sidebar-accent"
        }`}
      >
        <Network className="h-4 w-4" />
        Graphe
      </Link>
      <Link
        href="/ai"
        className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
          pathname === "/ai"
            ? "bg-sidebar-accent font-medium"
            : "hover:bg-sidebar-accent"
        }`}
      >
        <Sparkles className="h-4 w-4" />
        Assistant IA
      </Link>
      <Link
        href="/calendar"
        className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
          pathname === "/calendar"
            ? "bg-sidebar-accent font-medium"
            : "hover:bg-sidebar-accent"
        }`}
      >
        <CalendarDays className="h-4 w-4" />
        Calendrier
      </Link>
      <Link
        href="/meet"
        className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
          pathname.startsWith("/meet")
            ? "bg-sidebar-accent font-medium"
            : "hover:bg-sidebar-accent"
        }`}
      >
        <Video className="h-4 w-4" />
        Réunions
      </Link>
      <Link
        href="/organisation"
        className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
          pathname.startsWith("/organisation")
            ? "bg-sidebar-accent font-medium"
            : "hover:bg-sidebar-accent"
        }`}
      >
        <Building2 className="h-4 w-4" />
        Organisation
      </Link>

      {user &&
        (user.globalRole === "admin" ||
          user.globalRole === "super_admin" ||
          user.globalRole === "facility_manager") && (
          <Link
            href="/admin"
            className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
              pathname.startsWith("/admin")
                ? "bg-sidebar-accent font-medium"
                : "hover:bg-sidebar-accent"
            }`}
          >
            <Shield className="h-4 w-4" />
            Administration
          </Link>
        )}
    </nav>
  );
}

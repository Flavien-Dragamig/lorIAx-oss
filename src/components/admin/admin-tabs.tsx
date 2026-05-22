"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Users,
  Building2,
  FileText,
  Settings,
  Server,
  Shield,
  Key,
  Tag,
  PenLine,
  Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AccessLevel = "admin" | "facility_manager";
type Tab = {
  href: string;
  label: string;
  icon: typeof Users;
  access: AccessLevel[];
  superAdminOnly?: boolean;
};

const ALL: AccessLevel[] = ["admin"];

const tabs: Tab[] = [
  { href: "/admin/users", label: "Utilisateurs", icon: Users, access: ALL },
  { href: "/admin/teams", label: "Équipes", icon: Building2, access: ALL },
  { href: "/admin/organizations", label: "Organisations", icon: Building2, access: ALL, superAdminOnly: true },
  { href: "/admin/templates", label: "Templates", icon: FileText, access: ALL },
  { href: "/admin/labels", label: "Labels", icon: Tag, access: ALL },
  { href: "/admin/editor", label: "Éditeur", icon: PenLine, access: ALL },
  { href: "/admin/services", label: "Services", icon: Server, access: ALL },
  { href: "/admin/license", label: "Licence", icon: Key, access: ALL },
  { href: "/admin/telemetry", label: "Télémétrie", icon: Radio, access: ALL },
  { href: "/admin/system", label: "Système", icon: Settings, access: ALL },
];

interface AdminTabsProps {
  userRole: string;
}

export function AdminTabs({ userRole }: AdminTabsProps) {
  const pathname = usePathname();

  const isAdmin = userRole === "admin" || userRole === "super_admin";
  const isSuperAdmin = userRole === "super_admin";

  const visibleTabs = tabs.filter((t) => {
    if (t.superAdminOnly && !isSuperAdmin) return false;
    if (isAdmin && t.access.includes("admin")) return true;
    return false;
  });

  return (
    <div className="border-b border-border bg-card px-6 py-4">
      <div className="flex items-center gap-3 mb-4">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Administration</h1>
      </div>
      <div className="flex gap-1 flex-wrap">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

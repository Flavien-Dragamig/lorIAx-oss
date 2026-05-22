"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  Settings,
  Server,
  MessageSquare,
  Gauge,
  FlaskConical,
  ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin/ai", label: "Tableau de bord", icon: BarChart3, exact: true },
  { href: "/admin/ai/settings", label: "Réglages", icon: Settings },
  { href: "/admin/ai/providers", label: "Fournisseurs", icon: Server },
  { href: "/admin/ai/prompts", label: "Prompts", icon: MessageSquare },
  { href: "/admin/ai/quotas", label: "Quotas", icon: Gauge },
  { href: "/admin/ai/playground", label: "Playground", icon: FlaskConical },
  { href: "/admin/ai/logs", label: "Historique", icon: ScrollText },
];

export default function AdminAILayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full">
      <nav className="shrink-0 border-b bg-muted/30 px-4">
        <div className="flex items-center gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-3 py-3 text-sm whitespace-nowrap border-b-2 transition-colors",
                  isActive
                    ? "border-primary text-foreground font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}

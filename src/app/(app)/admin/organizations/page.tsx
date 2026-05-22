import { redirect } from "next/navigation";
import { Building2, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { desc, sql } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";
import Link from "next/link";
import { cn } from "@/lib/utils";

function PlanBadge({ plan }: { plan: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        plan === "enterprise"
          ? "bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground"
      )}
    >
      {plan}
    </span>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        isActive
          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
      )}
    >
      {isActive ? "Actif" : "Inactif"}
    </span>
  );
}

export default async function AdminOrganizationsPage() {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "super_admin")) redirect("/admin");

  const orgs = await db
    .select({
      id: organizations.id,
      slug: organizations.slug,
      name: organizations.name,
      plan: organizations.plan,
      isActive: organizations.isActive,
      memberCount: sql<number>`(
        SELECT COUNT(*) FROM organization_members WHERE organization_id = ${organizations.id}
      )`.mapWith(Number),
    })
    .from(organizations)
    .orderBy(desc(organizations.createdAt));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Organisations</h1>
        </div>
        <Link
          href="/admin/organizations/new"
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nouvelle organisation
        </Link>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Nom</th>
              <th className="text-left px-4 py-3 font-medium">Slug</th>
              <th className="text-left px-4 py-3 font-medium">Plan</th>
              <th className="text-left px-4 py-3 font-medium">Membres</th>
              <th className="text-left px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {orgs.map((org) => (
              <tr key={org.id} className="border-t border-border hover:bg-accent/50 transition-colors">
                <td className="px-4 py-3 font-medium">{org.name}</td>
                <td className="px-4 py-3 text-muted-foreground font-mono">{org.slug}</td>
                <td className="px-4 py-3">
                  <PlanBadge plan={org.plan} />
                </td>
                <td className="px-4 py-3">{org.memberCount}</td>
                <td className="px-4 py-3">
                  <StatusBadge isActive={org.isActive} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/organizations/${org.slug}`}
                    className="text-sm text-primary hover:underline"
                  >
                    Gérer
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orgs.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Aucune organisation</p>
        )}
      </div>
    </div>
  );
}

import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { organizations, organizationMembers, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";
import { Building2 } from "lucide-react";
import { OrgMembersTable } from "./org-detail-client";

export default async function OrgDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "super_admin")) redirect("/admin");

  const { slug } = await params;
  const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
  if (!org) notFound();

  const members = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      role: organizationMembers.role,
      joinedAt: organizationMembers.joinedAt,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(eq(organizationMembers.organizationId, org.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Building2 className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{org.name}</h1>
          <p className="text-muted-foreground font-mono text-sm">{org.slug}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Plan</p>
          <p className="text-lg font-semibold mt-1">{org.plan}</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Utilisateurs max</p>
          <p className="text-lg font-semibold mt-1">{org.maxUsers}</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Espaces max</p>
          <p className="text-lg font-semibold mt-1">{org.maxSpaces}</p>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Membres ({members.length})</h2>
        <OrgMembersTable slug={org.slug} members={members} />
      </div>
    </div>
  );
}

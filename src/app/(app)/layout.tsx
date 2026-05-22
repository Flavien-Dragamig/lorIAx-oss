export const dynamic = "force-dynamic";

import { Providers } from "@/components/providers";
import { FavoritesProvider } from "@/hooks/use-favorites";
import { ResponsiveLayout } from "@/components/layout/responsive-layout";
import { CommandPalette } from "@/components/sidebar/command-palette";
import { TeamPanel } from "@/components/presence/team-panel";
import { db } from "@/lib/db";
import { systemSettings, organizations, organizationMembers } from "@/lib/db/schema";
import { eq, and, count } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { OrganizationProvider } from "@/lib/org/organization-context";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";
import { getLicenseForClient } from "@/lib/license/get-license-for-client";

async function checkSetupCompleted() {
  const [row] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, "setup_completed"))
    .limit(1);

  if (!row || row.value !== true) {
    // Si l'utilisateur a cliqué « Plus tard », ne pas reproposer pendant la session
    const cookieStore = await cookies();
    if (cookieStore.get("setup_skipped")) {
      return;
    }
    redirect("/setup");
  }
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await checkSetupCompleted();
  const licenseData = await getLicenseForClient();

  const h = await headers();
  const orgSlug = h.get("x-org-slug") ?? "default";

  const currentUser = await getSessionUser();
  const [org] = currentUser
    ? await db.select().from(organizations).where(eq(organizations.slug, orgSlug)).limit(1)
    : [];

  // Si le slug provient du sous-domaine (non-default) et que l'org est introuvable, rediriger
  if (orgSlug !== "default" && !org) {
    redirect(`/org-not-found?slug=${encodeURIComponent(orgSlug)}`);
  }

  let orgRole = null;
  if (org && currentUser && !hasGlobalRole(currentUser.globalRole, "super_admin")) {
    const [m] = await db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, org.id), eq(organizationMembers.userId, currentUser.id)))
      .limit(1);
    orgRole = m?.role ?? null;
  }

  let orgMemberCount = 0;
  if (org) {
    const [c] = await db
      .select({ value: count() })
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, org.id));
    orgMemberCount = c?.value ?? 0;
  }

  const orgValue = {
    org: org
      ? { id: org.id, slug: org.slug, name: org.name, plan: org.plan, maxUsers: org.maxUsers, maxSpaces: org.maxSpaces, memberCount: orgMemberCount }
      : null,
    role: orgRole as "owner" | "admin" | "member" | null,
    isSuperAdmin: currentUser ? hasGlobalRole(currentUser.globalRole, "super_admin") : false,
  };

  return (
    <OrganizationProvider value={orgValue}>
      <Providers licenseData={licenseData}>
        <FavoritesProvider>
          <ResponsiveLayout>{children}</ResponsiveLayout>
          <CommandPalette />
          <TeamPanel />
        </FavoritesProvider>
      </Providers>
    </OrganizationProvider>
  );
}

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { organizations, organizationMembers } from "@/lib/db/schema";
import { eq, and, count } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json(null, { status: 401 });

  const h = await headers();
  const slug = h.get("x-org-slug") ?? "default";

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  if (!org) return NextResponse.json(null, { status: 404 });

  let role: string | null = null;
  if (!hasGlobalRole(user.globalRole, "super_admin")) {
    const [membership] = await db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, org.id),
          eq(organizationMembers.userId, user.id)
        )
      )
      .limit(1);
    role = membership?.role ?? null;
  }

  const [{ value: memberCount }] = await db
    .select({ value: count() })
    .from(organizationMembers)
    .where(eq(organizationMembers.organizationId, org.id));

  return NextResponse.json({
    org: {
      id: org.id,
      slug: org.slug,
      name: org.name,
      plan: org.plan,
      maxUsers: org.maxUsers,
      maxSpaces: org.maxSpaces,
      memberCount,
    },
    role,
    isSuperAdmin: hasGlobalRole(user.globalRole, "super_admin"),
  });
}

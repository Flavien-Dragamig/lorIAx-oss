import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizations, organizationMembers } from "@/lib/db/schema-org";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const [row] = await db
    .select({ slug: organizations.slug })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
    .where(eq(organizationMembers.userId, user.id))
    .limit(1);

  return NextResponse.json({
    authenticated: true,
    userId: user.id,
    email: user.email,
    globalRole: user.globalRole,
    orgSlug: row?.slug ?? null,
  });
}

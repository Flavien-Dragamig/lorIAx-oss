import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizations, organizationMembers, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";
import { syncOrgSeats } from "@/lib/billing/sync-seats";
import { z } from "zod";

async function getOrg(slug: string) {
  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);
  return org ?? null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "super_admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const { slug } = await params;
  const org = await getOrg(slug);
  if (!org) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const members = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
      role: organizationMembers.role,
      joinedAt: organizationMembers.joinedAt,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(eq(organizationMembers.organizationId, org.id));

  return NextResponse.json(members);
}

const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["owner", "admin", "member"]).default("member"),
});

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "super_admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const { slug } = await params;
  const org = await getOrg(slug);
  if (!org) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const parsed = addMemberSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  await db
    .insert(organizationMembers)
    .values({ organizationId: org.id, ...parsed.data })
    .onConflictDoUpdate({
      target: [organizationMembers.organizationId, organizationMembers.userId],
      set: { role: parsed.data.role },
    });

  await syncOrgSeats(org.id);

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "super_admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const { slug } = await params;
  const org = await getOrg(slug);
  if (!org) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId requis" }, { status: 400 });

  await db.delete(organizationMembers).where(
    and(
      eq(organizationMembers.organizationId, org.id),
      eq(organizationMembers.userId, userId)
    )
  );

  await syncOrgSeats(org.id);

  return NextResponse.json({ ok: true });
}

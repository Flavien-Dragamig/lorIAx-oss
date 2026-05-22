import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";
import { z } from "zod";

export async function GET() {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "super_admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const orgs = await db
    .select({
      id: organizations.id,
      slug: organizations.slug,
      name: organizations.name,
      plan: organizations.plan,
      maxUsers: organizations.maxUsers,
      maxSpaces: organizations.maxSpaces,
      isActive: organizations.isActive,
      createdAt: organizations.createdAt,
      memberCount: sql<number>`(
        SELECT COUNT(*) FROM organization_members
        WHERE organization_id = ${organizations.id}
      )`.mapWith(Number),
    })
    .from(organizations)
    .orderBy(desc(organizations.createdAt));

  return NextResponse.json(orgs);
}

const createOrgSchema = z.object({
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(255),
  plan: z.enum(["community", "team", "enterprise"]).default("community"),
  maxUsers: z.number().int().positive().default(5),
  maxSpaces: z.number().int().positive().default(10),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "super_admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createOrgSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [existing] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, parsed.data.slug))
    .limit(1);

  if (existing) {
    return NextResponse.json({ error: "Ce slug est déjà utilisé" }, { status: 409 });
  }

  const [org] = await db.insert(organizations).values(parsed.data).returning();
  return NextResponse.json(org, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { templates } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { z } from "zod";
import { BUILTIN_TEMPLATES } from "@/lib/templates/builtin";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json([], { status: 401 });

  const spaceId = request.nextUrl.searchParams.get("spaceId");

  const dbTemplates = await db
    .select()
    .from(templates)
    .where(
      spaceId
        ? or(eq(templates.isGlobal, true), eq(templates.spaceId, spaceId))
        : undefined
    )
    .orderBy(templates.category, templates.name);

  // Merge builtins (non surchargés par un enregistrement DB du même nom)
  const dbNames = new Set(dbTemplates.map((t) => t.name));
  const builtins = BUILTIN_TEMPLATES.filter((t) => !dbNames.has(t.name));

  const all = [...builtins, ...dbTemplates].sort((a, b) => {
    const catCmp = (a.category ?? "").localeCompare(b.category ?? "", "fr");
    if (catCmp !== 0) return catCmp;
    return a.name.localeCompare(b.name, "fr");
  });

  return NextResponse.json(all);
}

const createTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  content: z.any(),
  icon: z.string().optional(),
  category: z.string().optional(),
  isGlobal: z.boolean().optional(),
  spaceId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await request.json();
  const parsed = createTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  // Si isGlobal: true, vérifier que l'utilisateur est admin
  if (parsed.data.isGlobal) {
    if (user.globalRole !== "admin" && user.globalRole !== "super_admin") {
      return NextResponse.json(
        { error: "Seuls les administrateurs peuvent créer des templates globaux" },
        { status: 403 }
      );
    }
  }

  const [template] = await db
    .insert(templates)
    .values({
      ...parsed.data,
      createdBy: user.id,
    })
    .returning();

  return NextResponse.json(template, { status: 201 });
}

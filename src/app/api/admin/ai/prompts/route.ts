import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aiPrompts, aiPromptVersions } from "@/lib/db/schema-ai";
import { eq, sql, count } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";
import { BUILTIN_PROMPTS } from "@/lib/ai/builtin-prompts";

export async function GET() {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const dbPrompts = await db
    .select({
      id: aiPrompts.id,
      name: aiPrompts.name,
      slug: aiPrompts.slug,
      usageType: aiPrompts.usageType,
      description: aiPrompts.description,
      isActive: aiPrompts.isActive,
      createdBy: aiPrompts.createdBy,
      createdAt: aiPrompts.createdAt,
      updatedAt: aiPrompts.updatedAt,
      versionCount: count(aiPromptVersions.id),
      activeVersionNumber: sql<number | null>`max(case when ${aiPromptVersions.isActive} = true then ${aiPromptVersions.versionNumber} else null end)`,
      activeVersionCount: sql<number>`count(*) filter (where ${aiPromptVersions.isActive} = true)::int`,
    })
    .from(aiPrompts)
    .leftJoin(aiPromptVersions, eq(aiPrompts.id, aiPromptVersions.promptId))
    .groupBy(aiPrompts.id)
    .orderBy(aiPrompts.updatedAt);

  const dbSlugs = new Set(dbPrompts.map((p) => p.slug));

  // Builtins non surchargés par un enregistrement DB du même slug
  const builtinRows = BUILTIN_PROMPTS
    .filter((b) => !dbSlugs.has(b.slug))
    .map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      usageType: b.usageType,
      description: b.description,
      isActive: true,
      isBuiltin: true,
      createdBy: null,
      createdAt: null,
      updatedAt: null,
      versionCount: 1,
      activeVersionNumber: 1,
      activeVersionCount: 1,
      hasAbTest: false,
    }));

  const dbRows = dbPrompts.map((p) => ({
    ...p,
    isBuiltin: false,
    hasAbTest: (p.activeVersionCount ?? 0) > 1,
  }));

  return NextResponse.json([...builtinRows, ...dbRows]);
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await request.json();
  const {
    name,
    slug,
    usageType,
    description,
    systemPrompt,
    userPromptTemplate,
    variables,
    changeNote,
  } = body;

  if (!name || !slug || !usageType || !systemPrompt || !changeNote) {
    return NextResponse.json(
      { error: "Champs obligatoires manquants (name, slug, usageType, systemPrompt, changeNote)" },
      { status: 400 }
    );
  }

  // Create prompt
  const [prompt] = await db
    .insert(aiPrompts)
    .values({
      name,
      slug,
      usageType,
      description: description || null,
      isActive: true,
      createdBy: user.id,
    })
    .returning();

  // Create first version
  const [version] = await db
    .insert(aiPromptVersions)
    .values({
      promptId: prompt.id,
      versionNumber: 1,
      systemPrompt,
      userPromptTemplate: userPromptTemplate || null,
      variables: variables || [],
      isActive: true,
      trafficPercentage: 100,
      changeNote,
      createdBy: user.id,
    })
    .returning();

  return NextResponse.json({ prompt, version }, { status: 201 });
}

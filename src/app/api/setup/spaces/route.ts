// src/app/api/setup/spaces/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { spaces } from "@/lib/db/schema";
import { initRepository } from "@/lib/git/repository";
import { guardSetupNotCompleted } from "@/lib/setup/guards";
import { getDefaultOrgId } from "@/lib/org/get-org-id";

interface SpaceInput {
  name: string;
  description?: string;
  classification: "public" | "internal" | "confidential" | "secret";
  icon?: string;
}

export async function POST(request: NextRequest) {
  const blocked = await guardSetupNotCompleted();
  if (blocked) return blocked;

  const body = await request.json();
  const { spaces: spaceInputs } = body as { spaces: SpaceInput[] };

  if (!Array.isArray(spaceInputs) || spaceInputs.length === 0) {
    return NextResponse.json(
      { error: "Au moins un espace est requis" },
      { status: 400 }
    );
  }

  const orgId = await getDefaultOrgId();
  const createdIds: string[] = [];

  for (const input of spaceInputs) {
    if (!input.name?.trim()) {
      return NextResponse.json(
        { error: "Le nom de chaque espace est obligatoire" },
        { status: 400 }
      );
    }

    const slug =
      input.name
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") +
      "-" +
      Date.now();

    const gitRepoPath = `spaces/${slug}`;

    const [created] = await db
      .insert(spaces)
      .values({
        name: input.name.trim(),
        slug,
        description: input.description?.trim() || null,
        classification: input.classification ?? "internal",
        icon: input.icon ?? null,
        type: "organization",
        gitRepoPath,
        organizationId: orgId,
      })
      .returning({ id: spaces.id });

    await initRepository(gitRepoPath);

    createdIds.push(created.id);
  }

  return NextResponse.json({ success: true, ids: createdIds });
}

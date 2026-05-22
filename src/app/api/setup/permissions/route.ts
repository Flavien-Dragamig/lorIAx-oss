// src/app/api/setup/permissions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { spacePermissions } from "@/lib/db/schema";
import { guardSetupNotCompleted } from "@/lib/setup/guards";

interface PermissionEntry {
  spaceId: string;
  userId: string;
  level: "viewer" | "editor" | "admin";
}

export async function POST(request: NextRequest) {
  const blocked = await guardSetupNotCompleted();
  if (blocked) return blocked;

  const body = await request.json();
  const { permissions } = body as { permissions: PermissionEntry[] };

  if (!Array.isArray(permissions) || permissions.length === 0) {
    return NextResponse.json(
      { error: "La liste des permissions est obligatoire" },
      { status: 400 }
    );
  }

  for (const p of permissions) {
    if (!p.spaceId || !p.userId || !p.level) {
      return NextResponse.json(
        { error: "Chaque permission doit contenir spaceId, userId et level" },
        { status: 400 }
      );
    }
    if (!["viewer", "editor", "admin"].includes(p.level)) {
      return NextResponse.json(
        { error: `Niveau invalide : ${p.level}` },
        { status: 400 }
      );
    }
  }

  await db.insert(spacePermissions).values(
    permissions.map((p) => ({
      spaceId: p.spaceId,
      userId: p.userId,
      teamId: null,
      level: p.level,
    }))
  );

  return NextResponse.json({ success: true });
}

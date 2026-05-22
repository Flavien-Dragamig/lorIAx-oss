import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";
import { getVisioPermissionMatrix, setVisioPermission } from "@/lib/meet/permissions";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const spaceId = req.nextUrl.searchParams.get("spaceId") || null;
  const matrix = await getVisioPermissionMatrix(spaceId);
  return NextResponse.json(matrix);
}

const updateSchema = z.object({
  spaceId: z.string().uuid().nullable().default(null),
  action: z.enum([
    "join_immediate",
    "join_scheduled_invited",
    "join_scheduled_uninvited",
    "create_immediate",
    "create_scheduled",
    "modify_cancel",
  ]),
  role: z.enum(["viewer", "editor"]),
  allowed: z.boolean(),
});

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  await setVisioPermission(
    parsed.data.spaceId,
    parsed.data.action,
    parsed.data.role,
    parsed.data.allowed
  );

  return NextResponse.json({ success: true });
}

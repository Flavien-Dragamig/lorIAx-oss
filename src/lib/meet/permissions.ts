import { db } from "@/lib/db";
import { visioPermissions } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getSpacePermission } from "@/lib/auth/check-access";
import type { PermissionLevel, VisioAction } from "@/types";

const DEFAULTS: Record<VisioAction, Record<PermissionLevel, boolean>> = {
  join_immediate:           { viewer: true,  editor: true,  admin: true },
  join_scheduled_invited:   { viewer: true,  editor: true,  admin: true },
  join_scheduled_uninvited: { viewer: false, editor: true,  admin: true },
  create_immediate:         { viewer: false, editor: true,  admin: true },
  create_scheduled:         { viewer: false, editor: true,  admin: true },
  modify_cancel:            { viewer: false, editor: false, admin: true },
};

export async function checkVisioPermission(
  userId: string,
  spaceId: string,
  action: VisioAction
): Promise<boolean> {
  const userRole = await getSpacePermission(userId, spaceId);
  if (!userRole) return false;
  if (userRole === "admin") return true;

  const [spaceOverride] = await db
    .select({ allowed: visioPermissions.allowed })
    .from(visioPermissions)
    .where(
      and(
        eq(visioPermissions.spaceId, spaceId),
        eq(visioPermissions.action, action),
        eq(visioPermissions.role, userRole)
      )
    )
    .limit(1);

  if (spaceOverride) return spaceOverride.allowed;

  const [globalOverride] = await db
    .select({ allowed: visioPermissions.allowed })
    .from(visioPermissions)
    .where(
      and(
        isNull(visioPermissions.spaceId),
        eq(visioPermissions.action, action),
        eq(visioPermissions.role, userRole)
      )
    )
    .limit(1);

  if (globalOverride) return globalOverride.allowed;

  return DEFAULTS[action]?.[userRole] ?? false;
}

export async function getVisioPermissionMatrix(
  spaceId: string | null
): Promise<Record<VisioAction, Record<PermissionLevel, boolean>>> {
  const condition = spaceId
    ? eq(visioPermissions.spaceId, spaceId)
    : isNull(visioPermissions.spaceId);

  const rows = await db
    .select()
    .from(visioPermissions)
    .where(condition);

  const matrix = structuredClone(DEFAULTS);

  for (const row of rows) {
    if (matrix[row.action as VisioAction]) {
      matrix[row.action as VisioAction][row.role as PermissionLevel] = row.allowed;
    }
  }

  return matrix;
}

export async function setVisioPermission(
  spaceId: string | null,
  action: VisioAction,
  role: PermissionLevel,
  allowed: boolean
): Promise<void> {
  const existing = await db
    .select({ id: visioPermissions.id })
    .from(visioPermissions)
    .where(
      and(
        spaceId ? eq(visioPermissions.spaceId, spaceId) : isNull(visioPermissions.spaceId),
        eq(visioPermissions.action, action),
        eq(visioPermissions.role, role)
      )
    )
    .limit(1);

  if (existing.length) {
    await db
      .update(visioPermissions)
      .set({ allowed, updatedAt: new Date() })
      .where(eq(visioPermissions.id, existing[0].id));
  } else {
    await db.insert(visioPermissions).values({
      spaceId,
      action,
      role,
      allowed,
    });
  }
}

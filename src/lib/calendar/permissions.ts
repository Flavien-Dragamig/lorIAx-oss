import { db } from "@/lib/db";
import {
  calendars,
  calendarSubscriptions,
  spacePermissions,
  teamMembers,
} from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { hasGlobalRole } from "@/lib/auth/rbac";
import type { SessionUser, CalendarPermission } from "@/types";

/**
 * Check if a user can perform an action on a calendar.
 * Returns the permission level or null if no access.
 */
export async function checkCalendarAccess(
  userId: string,
  calendarId: string,
  action: "read" | "write" | "admin"
): Promise<boolean> {
  const calendar = await db
    .select()
    .from(calendars)
    .where(eq(calendars.id, calendarId))
    .limit(1);

  if (calendar.length === 0) return false;
  const cal = calendar[0];

  // Owner always has full access
  if (cal.ownerUserId === userId) return true;

  // Check subscription-based permission
  const sub = await db
    .select()
    .from(calendarSubscriptions)
    .where(
      and(
        eq(calendarSubscriptions.calendarId, calendarId),
        eq(calendarSubscriptions.userId, userId)
      )
    )
    .limit(1);

  if (sub.length > 0) {
    const perm = sub[0].permission;
    if (action === "read") return true;
    if (action === "write") return perm === "write" || perm === "admin";
    if (action === "admin") return perm === "admin";
  }

  // Team calendar: check team membership
  if (cal.type === "team" && cal.ownerTeamId) {
    const membership = await db
      .select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, cal.ownerTeamId),
          eq(teamMembers.userId, userId)
        )
      )
      .limit(1);

    if (membership.length > 0) {
      if (action === "read") return true;
      if (action === "write") return true;
      if (action === "admin") return membership[0].role === "admin";
    }
  }

  // Organization calendar: any authenticated user can read
  if (cal.type === "organization") {
    if (action === "read") return true;
  }

  // Check via associated space permissions
  if (cal.spaceId) {
    return checkSpaceBasedAccess(userId, cal.spaceId, action);
  }

  return false;
}

async function checkSpaceBasedAccess(
  userId: string,
  spaceId: string,
  action: "read" | "write" | "admin"
): Promise<boolean> {
  // Direct user permission
  const perms = await db
    .select()
    .from(spacePermissions)
    .where(
      and(
        eq(spacePermissions.spaceId, spaceId),
        eq(spacePermissions.userId, userId)
      )
    )
    .limit(1);

  if (perms.length > 0) {
    const level = perms[0].level;
    if (action === "read") return true;
    if (action === "write") return level === "editor" || level === "admin";
    if (action === "admin") return level === "admin";
  }

  // Team-based permission
  const userTeams = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId));

  if (userTeams.length > 0) {
    const teamIds = userTeams.map((t) => t.teamId);
    const teamPerms = await db
      .select()
      .from(spacePermissions)
      .where(
        and(
          eq(spacePermissions.spaceId, spaceId),
          inArray(spacePermissions.teamId, teamIds)
        )
      );

    if (teamPerms.length > 0) {
      const bestLevel = teamPerms.reduce((best, p) => {
        const order: Record<string, number> = { admin: 3, editor: 2, viewer: 1 };
        return (order[p.level] || 0) > (order[best] || 0) ? p.level : best;
      }, "viewer" as string);

      if (action === "read") return true;
      if (action === "write") return bestLevel === "editor" || bestLevel === "admin";
      if (action === "admin") return bestLevel === "admin";
    }
  }

  return false;
}

/**
 * Get all calendar IDs a user can access.
 */
export async function getAccessibleCalendarIds(
  user: SessionUser
): Promise<string[]> {
  // Admins see everything
  if (hasGlobalRole(user.globalRole, "admin")) {
    const all = await db.select({ id: calendars.id }).from(calendars);
    return all.map((c) => c.id);
  }

  // Own calendars
  const ownCalendars = await db
    .select({ id: calendars.id })
    .from(calendars)
    .where(eq(calendars.ownerUserId, user.id));

  // Subscribed calendars
  const subs = await db
    .select({ calendarId: calendarSubscriptions.calendarId })
    .from(calendarSubscriptions)
    .where(eq(calendarSubscriptions.userId, user.id));

  // Organization calendars (everyone can read)
  const orgCalendars = await db
    .select({ id: calendars.id })
    .from(calendars)
    .where(eq(calendars.type, "organization"));

  // Team calendars where user is a member
  const userTeams = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, user.id));

  let teamCalendarIds: string[] = [];
  if (userTeams.length > 0) {
    const teamIds = userTeams.map((t) => t.teamId);
    const teamCals = await db
      .select({ id: calendars.id })
      .from(calendars)
      .where(
        and(
          eq(calendars.type, "team"),
          inArray(calendars.ownerTeamId, teamIds)
        )
      );
    teamCalendarIds = teamCals.map((c) => c.id);
  }

  const allIds = new Set([
    ...ownCalendars.map((c) => c.id),
    ...subs.map((s) => s.calendarId),
    ...orgCalendars.map((c) => c.id),
    ...teamCalendarIds,
  ]);

  return [...allIds];
}

/**
 * Determine the permission level for a user on a calendar.
 */
export async function getCalendarPermission(
  user: SessionUser,
  calendarId: string
): Promise<CalendarPermission | null> {
  if (hasGlobalRole(user.globalRole, "admin")) return "admin";

  const calendar = await db
    .select()
    .from(calendars)
    .where(eq(calendars.id, calendarId))
    .limit(1);

  if (calendar.length === 0) return null;
  const cal = calendar[0];

  if (cal.ownerUserId === user.id) return "admin";

  // Subscription
  const sub = await db
    .select()
    .from(calendarSubscriptions)
    .where(
      and(
        eq(calendarSubscriptions.calendarId, calendarId),
        eq(calendarSubscriptions.userId, user.id)
      )
    )
    .limit(1);

  if (sub.length > 0) return sub[0].permission;

  // Team membership
  if (cal.type === "team" && cal.ownerTeamId) {
    const membership = await db
      .select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, cal.ownerTeamId),
          eq(teamMembers.userId, user.id)
        )
      )
      .limit(1);

    if (membership.length > 0) {
      return membership[0].role === "admin" ? "admin" : "write";
    }
  }

  // Organization: any user can read
  if (cal.type === "organization") return "read";

  return null;
}

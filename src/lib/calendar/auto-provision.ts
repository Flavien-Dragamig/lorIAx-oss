import { db } from "@/lib/db";
import {
  calendars,
  calendarSubscriptions,
  teamMembers,
  users,
  teams,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import slugify from "slugify";
import crypto from "crypto";
import logger from "@/lib/logger";

/**
 * Auto-create a personal calendar for a user (if not already existing).
 */
export async function ensurePersonalCalendar(userId: string, userName: string): Promise<string> {
  // Check if user already has a default personal calendar
  const existing = await db
    .select({ id: calendars.id })
    .from(calendars)
    .where(
      and(
        eq(calendars.ownerUserId, userId),
        eq(calendars.type, "personal"),
        eq(calendars.isDefault, true)
      )
    )
    .limit(1);

  if (existing.length > 0) return existing[0].id;

  const baseSlug = slugify(userName, { lower: true, strict: true });
  const caldavSlug = `personal-${baseSlug}-${crypto.randomBytes(4).toString("hex")}`;

  const [cal] = await db
    .insert(calendars)
    .values({
      name: `Calendrier de ${userName}`,
      description: "Calendrier personnel",
      color: "#3b82f6",
      timezone: "Europe/Paris",
      type: "personal",
      ownerUserId: userId,
      caldavSlug,
      isDefault: true,
    })
    .returning();

  logger.info({ userId, calendarId: cal.id }, "[calendar] Personal calendar created");
  return cal.id;
}

/**
 * Auto-create a team calendar when a team is created (if not already existing).
 */
export async function ensureTeamCalendar(teamId: string, teamName: string): Promise<string> {
  const existing = await db
    .select({ id: calendars.id })
    .from(calendars)
    .where(
      and(
        eq(calendars.ownerTeamId, teamId),
        eq(calendars.type, "team"),
        eq(calendars.isDefault, true)
      )
    )
    .limit(1);

  if (existing.length > 0) return existing[0].id;

  const baseSlug = slugify(teamName, { lower: true, strict: true });
  const caldavSlug = `team-${baseSlug}-${crypto.randomBytes(4).toString("hex")}`;

  const [cal] = await db
    .insert(calendars)
    .values({
      name: `Calendrier ${teamName}`,
      description: `Calendrier de l'équipe ${teamName}`,
      color: "#10b981",
      timezone: "Europe/Paris",
      type: "team",
      ownerTeamId: teamId,
      caldavSlug,
      isDefault: true,
    })
    .returning();

  // Auto-subscribe all team members
  const members = await db
    .select({ userId: teamMembers.userId, role: teamMembers.role })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId));

  if (members.length > 0) {
    await db.insert(calendarSubscriptions).values(
      members.map((m) => ({
        userId: m.userId,
        calendarId: cal.id,
        permission: (m.role === "admin" ? "admin" : "write") as "read" | "write" | "admin",
      }))
    ).onConflictDoNothing();
  }

  logger.info({ teamId, calendarId: cal.id }, "[calendar] Team calendar created");
  return cal.id;
}

/**
 * Auto-subscribe a user to their team's calendar when they join a team.
 */
export async function subscribeToTeamCalendar(
  userId: string,
  teamId: string,
  role: string
): Promise<void> {
  const teamCals = await db
    .select({ id: calendars.id })
    .from(calendars)
    .where(
      and(
        eq(calendars.ownerTeamId, teamId),
        eq(calendars.type, "team")
      )
    );

  for (const cal of teamCals) {
    await db
      .insert(calendarSubscriptions)
      .values({
        userId,
        calendarId: cal.id,
        permission: (role === "admin" ? "admin" : "write") as "read" | "write" | "admin",
      })
      .onConflictDoNothing();
  }
}

/**
 * Remove a user's subscription to their team's calendar when they leave.
 */
export async function unsubscribeFromTeamCalendar(
  userId: string,
  teamId: string
): Promise<void> {
  const teamCals = await db
    .select({ id: calendars.id })
    .from(calendars)
    .where(
      and(
        eq(calendars.ownerTeamId, teamId),
        eq(calendars.type, "team")
      )
    );

  for (const cal of teamCals) {
    await db
      .delete(calendarSubscriptions)
      .where(
        and(
          eq(calendarSubscriptions.userId, userId),
          eq(calendarSubscriptions.calendarId, cal.id)
        )
      );
  }
}

/**
 * Create an organization-wide calendar (only one should exist).
 */
export async function ensureOrganizationCalendar(createdByUserId: string): Promise<string> {
  const existing = await db
    .select({ id: calendars.id })
    .from(calendars)
    .where(eq(calendars.type, "organization"))
    .limit(1);

  if (existing.length > 0) return existing[0].id;

  const caldavSlug = `org-${crypto.randomBytes(4).toString("hex")}`;

  const [cal] = await db
    .insert(calendars)
    .values({
      name: "Calendrier organisation",
      description: "Calendrier partagé de l'organisation",
      color: "#8b5cf6",
      timezone: "Europe/Paris",
      type: "organization",
      ownerUserId: createdByUserId,
      caldavSlug,
      isDefault: true,
    })
    .returning();

  logger.info({ calendarId: cal.id }, "[calendar] Organization calendar created");
  return cal.id;
}

/**
 * Migration: create personal calendars for all existing users who don't have one.
 */
export async function migrateExistingUsers(): Promise<number> {
  const usersWithoutCal = await db
    .select({ id: users.id, name: users.name })
    .from(users);

  let count = 0;
  for (const user of usersWithoutCal) {
    const existing = await db
      .select({ id: calendars.id })
      .from(calendars)
      .where(
        and(
          eq(calendars.ownerUserId, user.id),
          eq(calendars.type, "personal"),
          eq(calendars.isDefault, true)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      await ensurePersonalCalendar(user.id, user.name);
      count++;
    }
  }

  return count;
}

/**
 * Migration: create team calendars for all existing teams who don't have one.
 */
export async function migrateExistingTeams(): Promise<number> {
  const allTeams = await db.select({ id: teams.id, name: teams.name }).from(teams);

  let count = 0;
  for (const team of allTeams) {
    const existing = await db
      .select({ id: calendars.id })
      .from(calendars)
      .where(
        and(
          eq(calendars.ownerTeamId, team.id),
          eq(calendars.type, "team"),
          eq(calendars.isDefault, true)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      await ensureTeamCalendar(team.id, team.name);
      count++;
    }
  }

  return count;
}

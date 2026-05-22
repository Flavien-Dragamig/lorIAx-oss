import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  calendars,
  calendarSubscriptions,
  teamMembers,
} from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { hasGlobalRole } from "@/lib/auth/rbac";
import { z } from "zod";
import slugify from "slugify";
import crypto from "crypto";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json([], { status: 401 });

  if (hasGlobalRole(user.globalRole, "admin")) {
    const all = await db.select().from(calendars).orderBy(calendars.name);
    return NextResponse.json(all);
  }

  // Own calendars
  const ownCalendars = await db
    .select()
    .from(calendars)
    .where(eq(calendars.ownerUserId, user.id));

  // Subscribed calendars
  const subs = await db
    .select({ calendarId: calendarSubscriptions.calendarId })
    .from(calendarSubscriptions)
    .where(eq(calendarSubscriptions.userId, user.id));

  const subIds = subs.map((s) => s.calendarId);
  let subscribedCalendars: (typeof calendars.$inferSelect)[] = [];
  if (subIds.length > 0) {
    subscribedCalendars = await db
      .select()
      .from(calendars)
      .where(inArray(calendars.id, subIds));
  }

  // Organization calendars
  const orgCalendars = await db
    .select()
    .from(calendars)
    .where(eq(calendars.type, "organization"));

  // Team calendars
  const userTeams = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, user.id));

  let teamCalendars: (typeof calendars.$inferSelect)[] = [];
  if (userTeams.length > 0) {
    const teamIds = userTeams.map((t) => t.teamId);
    teamCalendars = await db
      .select()
      .from(calendars)
      .where(
        and(
          eq(calendars.type, "team"),
          inArray(calendars.ownerTeamId, teamIds)
        )
      );
  }

  // Deduplicate by ID
  const allCals = new Map<string, typeof calendars.$inferSelect>();
  for (const cal of [
    ...ownCalendars,
    ...subscribedCalendars,
    ...orgCalendars,
    ...teamCalendars,
  ]) {
    allCals.set(cal.id, cal);
  }

  return NextResponse.json([...allCals.values()].sort((a, b) => a.name.localeCompare(b.name)));
}

const createCalendarSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  timezone: z.string().max(100).optional(),
  type: z.enum(["personal", "team", "organization"]).optional(),
  ownerTeamId: z.string().uuid().optional(),
  spaceId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await request.json();
  const parsed = createCalendarSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { name, description, color, timezone, type, ownerTeamId, spaceId } = parsed.data;
  const calType = type || "personal";

  // Only admins can create organization calendars
  if (calType === "organization" && !hasGlobalRole(user.globalRole, "admin")) {
    return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
  }

  // Team calendars require ownerTeamId
  if (calType === "team" && !ownerTeamId) {
    return NextResponse.json({ error: "ownerTeamId requis pour un calendrier d'équipe" }, { status: 400 });
  }

  const baseSlug = slugify(name, { lower: true, strict: true });
  const caldavSlug = `${baseSlug}-${crypto.randomBytes(4).toString("hex")}`;

  const [calendar] = await db
    .insert(calendars)
    .values({
      name,
      description,
      color: color || "#3b82f6",
      timezone: timezone || "Europe/Paris",
      type: calType,
      ownerUserId: calType !== "team" ? user.id : undefined,
      ownerTeamId: calType === "team" ? ownerTeamId : undefined,
      spaceId,
      caldavSlug,
      isDefault: false,
    })
    .returning();

  return NextResponse.json(calendar, { status: 201 });
}

import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { calendars, calendarSubscriptions, teamMembers } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { authenticateApiRequest } from "@/lib/api/auth-api";
import { apiSuccess, apiError } from "@/lib/api/response";
import { hasScope } from "@/lib/auth/api-key";

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if ("error" in auth) return auth.error;

  const { user } = auth;

  // Check scope
  if (user.scopes && !hasScope(user.scopes, "calendars:read")) {
    return apiError("Scope calendars:read requis", 403);
  }

  // Own calendars
  const ownCalendars = await db
    .select()
    .from(calendars)
    .where(eq(calendars.ownerUserId, user.id));

  // Subscribed
  const subs = await db
    .select({ calendarId: calendarSubscriptions.calendarId })
    .from(calendarSubscriptions)
    .where(eq(calendarSubscriptions.userId, user.id));

  const subIds = subs.map((s) => s.calendarId);
  let subscribedCalendars: (typeof calendars.$inferSelect)[] = [];
  if (subIds.length > 0) {
    subscribedCalendars = await db.select().from(calendars).where(inArray(calendars.id, subIds));
  }

  // Org calendars
  const orgCalendars = await db.select().from(calendars).where(eq(calendars.type, "organization"));

  // Team calendars
  const userTeams = await db.select({ teamId: teamMembers.teamId }).from(teamMembers).where(eq(teamMembers.userId, user.id));
  let teamCalendars: (typeof calendars.$inferSelect)[] = [];
  if (userTeams.length > 0) {
    const teamIds = userTeams.map((t) => t.teamId);
    teamCalendars = await db.select().from(calendars).where(and(eq(calendars.type, "team"), inArray(calendars.ownerTeamId, teamIds)));
  }

  const allCals = new Map<string, typeof calendars.$inferSelect>();
  for (const cal of [...ownCalendars, ...subscribedCalendars, ...orgCalendars, ...teamCalendars]) {
    allCals.set(cal.id, cal);
  }

  return apiSuccess([...allCals.values()].sort((a, b) => a.name.localeCompare(b.name)));
}

export async function POST(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if ("error" in auth) return auth.error;

  const { user } = auth;

  if (user.scopes && !hasScope(user.scopes, "calendars:write")) {
    return apiError("Scope calendars:write requis", 403);
  }

  const body = await request.json();
  const { name, description, color, timezone } = body;

  if (!name) return apiError("name requis");

  const slugify = (await import("slugify")).default;
  const crypto = await import("crypto");
  const baseSlug = slugify(name, { lower: true, strict: true });
  const caldavSlug = `${baseSlug}-${crypto.randomBytes(4).toString("hex")}`;

  const [calendar] = await db
    .insert(calendars)
    .values({
      name,
      description,
      color: color || "#3b82f6",
      timezone: timezone || "Europe/Paris",
      type: "personal",
      ownerUserId: user.id,
      caldavSlug,
    })
    .returning();

  return apiSuccess(calendar, undefined, 201);
}

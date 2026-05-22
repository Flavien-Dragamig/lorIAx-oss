import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { calendarEvents } from "@/lib/db/schema";
import { and, gte, lte, or, inArray } from "drizzle-orm";
import { authenticateApiRequest } from "@/lib/api/auth-api";
import { apiSuccess, apiError } from "@/lib/api/response";
import { hasScope } from "@/lib/auth/api-key";
import { getAccessibleCalendarIds } from "@/lib/calendar/permissions";

export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if ("error" in auth) return auth.error;

  const { user } = auth;

  if (user.scopes && !hasScope(user.scopes, "calendars:read")) {
    return apiError("Scope calendars:read requis", 403);
  }

  const searchParams = request.nextUrl.searchParams;
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");
  const calendarId = searchParams.get("calendarId");

  if (!startParam || !endParam) {
    return apiError("Paramètres start et end requis (ISO 8601)");
  }

  const rangeStart = new Date(startParam);
  const rangeEnd = new Date(endParam);

  if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) {
    return apiError("Dates invalides");
  }

  // Get accessible calendar IDs
  const accessibleIds = calendarId
    ? [calendarId]
    : await getAccessibleCalendarIds({
        id: user.id,
        email: user.email,
        name: user.name,
        globalRole: user.globalRole,
      });

  if (accessibleIds.length === 0) {
    return apiSuccess([]);
  }

  const events = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        inArray(calendarEvents.calendarId, accessibleIds),
        or(
          and(gte(calendarEvents.startAt, rangeStart), lte(calendarEvents.startAt, rangeEnd)),
          and(gte(calendarEvents.endAt, rangeStart), lte(calendarEvents.endAt, rangeEnd)),
          and(lte(calendarEvents.startAt, rangeStart), gte(calendarEvents.endAt, rangeEnd))
        )
      )
    )
    .orderBy(calendarEvents.startAt);

  return apiSuccess(events);
}

export async function POST(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if ("error" in auth) return auth.error;

  const { user } = auth;

  if (user.scopes && !hasScope(user.scopes, "calendars:write")) {
    return apiError("Scope calendars:write requis", 403);
  }

  const body = await request.json();
  const { calendarId, title, startAt, endAt, ...rest } = body;

  if (!calendarId || !title || !startAt || !endAt) {
    return apiError("calendarId, title, startAt, endAt requis");
  }

  const { checkCalendarAccess } = await import("@/lib/calendar/permissions");
  const hasAccess = await checkCalendarAccess(user.id, calendarId, "write");
  if (!hasAccess) return apiError("Accès refusé au calendrier", 403);

  const crypto = await import("crypto");
  const uid = `${crypto.randomUUID()}@loriax`;

  const [event] = await db
    .insert(calendarEvents)
    .values({
      calendarId,
      title,
      startAt: new Date(startAt),
      endAt: new Date(endAt),
      allDay: rest.allDay || false,
      description: rest.description,
      location: rest.location,
      recurrenceRule: rest.recurrenceRule,
      status: rest.status || "confirmed",
      visibility: rest.visibility || "public",
      color: rest.color,
      uid,
      createdBy: user.id,
    })
    .returning();

  return apiSuccess(event, undefined, 201);
}

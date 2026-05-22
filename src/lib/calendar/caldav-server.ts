import { db } from "@/lib/db";
import {
  calendars,
  calendarEvents,
  calendarEventAttendees,
  users,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { generateICalendar } from "@/lib/calendar/ical";
import { checkCalendarAccess } from "@/lib/calendar/permissions";
import type { SessionUser } from "@/types";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// CalDAV XML helpers
// ---------------------------------------------------------------------------

const DAV = "DAV:";
const CALDAV = "urn:ietf:params:xml:ns:caldav";
const CS = "http://calendarserver.org/ns/";

function xmlTag(ns: string, tag: string, content: string, attrs = ""): string {
  const prefix = ns === DAV ? "D" : ns === CALDAV ? "C" : "CS";
  return `<${prefix}:${tag}${attrs}>${content}</${prefix}:${tag}>`;
}

function xmlSelfClose(ns: string, tag: string): string {
  const prefix = ns === DAV ? "D" : ns === CALDAV ? "C" : "CS";
  return `<${prefix}:${tag}/>`;
}

function wrapMultistatus(body: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<D:multistatus xmlns:D="${DAV}" xmlns:C="${CALDAV}" xmlns:CS="${CS}">`,
    body,
    "</D:multistatus>",
  ].join("\n");
}

function wrapResponse(href: string, propstats: string): string {
  return xmlTag(DAV, "response", xmlTag(DAV, "href", href) + propstats);
}

function propstatOk(props: string): string {
  return xmlTag(
    DAV,
    "propstat",
    xmlTag(DAV, "prop", props) +
      xmlTag(DAV, "status", "HTTP/1.1 200 OK")
  );
}

function _propstatNotFound(props: string): string {
  return xmlTag(
    DAV,
    "propstat",
    xmlTag(DAV, "prop", props) +
      xmlTag(DAV, "status", "HTTP/1.1 404 Not Found")
  );
}

// ---------------------------------------------------------------------------
// Compute ETag / CTag
// ---------------------------------------------------------------------------

function computeETag(event: { uid: string; sequence: number; updatedAt: Date }): string {
  const data = `${event.uid}-${event.sequence}-${event.updatedAt.toISOString()}`;
  return `"${crypto.createHash("md5").update(data).digest("hex")}"`;
}

function computeCTag(dates: Date[]): string {
  if (dates.length === 0) return '"empty"';
  const latest = dates.reduce((a, b) => (a > b ? a : b));
  return `"${latest.getTime()}"`;
}

// ---------------------------------------------------------------------------
// Auth helper — Basic Auth for CalDAV
// ---------------------------------------------------------------------------

export async function authenticateCalDAV(
  request: Request
): Promise<SessionUser | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  // Basic Auth
  if (authHeader.startsWith("Basic ")) {
    const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf-8");
    const [email, password] = decoded.split(":");
    if (!email || !password) return null;

    const bcrypt = (await import("bcryptjs")).default;
    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (user.length === 0 || !user[0].passwordHash) return null;
    const valid = await bcrypt.compare(password, user[0].passwordHash);
    if (!valid) return null;

    return {
      id: user[0].id,
      email: user[0].email,
      name: user[0].name,
      globalRole: user[0].globalRole as SessionUser["globalRole"],
      avatarUrl: user[0].avatarUrl,
    };
  }

  // Bearer token (API key)
  if (authHeader.startsWith("Bearer ")) {
    const { resolveApiKey } = await import("@/lib/auth/api-key");
    const resolved = await resolveApiKey(authHeader.slice(7));
    if (!resolved) return null;

    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, resolved.userId))
      .limit(1);

    if (user.length === 0) return null;
    return {
      id: user[0].id,
      email: user[0].email,
      name: user[0].name,
      globalRole: user[0].globalRole as SessionUser["globalRole"],
      avatarUrl: user[0].avatarUrl,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Parse CalDAV path
// ---------------------------------------------------------------------------

interface CalDAVPath {
  type: "principal" | "home" | "calendar" | "event" | "unknown";
  principalId?: string; // userId
  calendarSlug?: string;
  eventFilename?: string; // e.g. "uid@loriax.ics"
}

export function parseCalDAVPath(pathSegments: string[]): CalDAVPath {
  // /caldav/:principalId/
  // /caldav/:principalId/:calendarSlug/
  // /caldav/:principalId/:calendarSlug/:eventFilename.ics

  if (pathSegments.length === 0) {
    return { type: "unknown" };
  }

  const principalId = pathSegments[0];

  if (pathSegments.length === 1) {
    return { type: "principal", principalId };
  }

  const calendarSlug = pathSegments[1];

  if (pathSegments.length === 2) {
    return { type: calendarSlug === "" ? "home" : "calendar", principalId, calendarSlug };
  }

  const eventFilename = pathSegments[2];
  if (eventFilename.endsWith(".ics")) {
    return { type: "event", principalId, calendarSlug, eventFilename };
  }

  return { type: "unknown", principalId, calendarSlug };
}

// ---------------------------------------------------------------------------
// PROPFIND handler
// ---------------------------------------------------------------------------

export async function handlePropfind(
  user: SessionUser,
  path: CalDAVPath,
  _body: string,
  baseUrl: string
): Promise<{ status: number; body: string }> {
  const caldavBase = `${baseUrl}/api/caldav`;

  if (path.type === "principal") {
    // Return principal resource + calendar-home-set
    const responses = wrapResponse(
      `${caldavBase}/${path.principalId}/`,
      propstatOk(
        xmlTag(DAV, "displayname", user.name) +
          xmlTag(DAV, "resourcetype", xmlSelfClose(DAV, "principal")) +
          xmlTag(
            CALDAV,
            "calendar-home-set",
            xmlTag(DAV, "href", `${caldavBase}/${path.principalId}/`)
          )
      )
    );
    return { status: 207, body: wrapMultistatus(responses) };
  }

  if (path.type === "home" || (path.type === "calendar" && !path.calendarSlug)) {
    // List all accessible calendars
    const userCalendars = await db
      .select()
      .from(calendars)
      .where(eq(calendars.ownerUserId, user.id));

    let responses = wrapResponse(
      `${caldavBase}/${path.principalId}/`,
      propstatOk(
        xmlTag(DAV, "displayname", "Calendriers") +
          xmlTag(
            DAV,
            "resourcetype",
            xmlSelfClose(DAV, "collection")
          )
      )
    );

    for (const cal of userCalendars) {
      const events = await db
        .select({ updatedAt: calendarEvents.updatedAt })
        .from(calendarEvents)
        .where(eq(calendarEvents.calendarId, cal.id));

      const ctag = computeCTag(events.map((e) => e.updatedAt));

      responses += wrapResponse(
        `${caldavBase}/${path.principalId}/${cal.caldavSlug}/`,
        propstatOk(
          xmlTag(DAV, "displayname", cal.name) +
            xmlTag(
              DAV,
              "resourcetype",
              xmlSelfClose(DAV, "collection") +
                xmlSelfClose(CALDAV, "calendar")
            ) +
            xmlTag(CS, "getctag", ctag) +
            xmlTag(
              CALDAV,
              "supported-calendar-component-set",
              `<C:comp name="VEVENT"/>`
            ) +
            xmlTag(
              CALDAV,
              "calendar-timezone",
              cal.timezone
            ) +
            xmlTag(
              DAV,
              "supported-report-set",
              xmlTag(DAV, "supported-report", xmlTag(DAV, "report", xmlSelfClose(CALDAV, "calendar-multiget"))) +
                xmlTag(DAV, "supported-report", xmlTag(DAV, "report", xmlSelfClose(CALDAV, "calendar-query")))
            )
        )
      );
    }

    return { status: 207, body: wrapMultistatus(responses) };
  }

  if (path.type === "calendar" && path.calendarSlug) {
    // List events in calendar
    const cal = await db
      .select()
      .from(calendars)
      .where(eq(calendars.caldavSlug, path.calendarSlug!))
      .limit(1);

    if (cal.length === 0) return { status: 404, body: "Calendar not found" };

    const hasAccess = await checkCalendarAccess(user.id, cal[0].id, "read");
    if (!hasAccess) return { status: 403, body: "Forbidden" };

    const events = await db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.calendarId, cal[0].id));

    const ctag = computeCTag(events.map((e) => e.updatedAt));

    let responses = wrapResponse(
      `${caldavBase}/${path.principalId}/${path.calendarSlug}/`,
      propstatOk(
        xmlTag(DAV, "displayname", cal[0].name) +
          xmlTag(
            DAV,
            "resourcetype",
            xmlSelfClose(DAV, "collection") +
              xmlSelfClose(CALDAV, "calendar")
          ) +
          xmlTag(CS, "getctag", ctag)
      )
    );

    for (const event of events) {
      const etag = computeETag(event);
      responses += wrapResponse(
        `${caldavBase}/${path.principalId}/${path.calendarSlug}/${event.uid}.ics`,
        propstatOk(
          xmlTag(DAV, "getetag", etag) +
            xmlTag(DAV, "getcontenttype", "text/calendar; charset=utf-8")
        )
      );
    }

    return { status: 207, body: wrapMultistatus(responses) };
  }

  return { status: 404, body: "Not found" };
}

// ---------------------------------------------------------------------------
// REPORT handler (calendar-query, calendar-multiget)
// ---------------------------------------------------------------------------

export async function handleReport(
  user: SessionUser,
  path: CalDAVPath,
  _body: string,
  baseUrl: string
): Promise<{ status: number; body: string }> {
  const caldavBase = `${baseUrl}/api/caldav`;

  if (path.type !== "calendar" || !path.calendarSlug) {
    return { status: 400, body: "REPORT only supported on calendar collections" };
  }

  const cal = await db
    .select()
    .from(calendars)
    .where(eq(calendars.caldavSlug, path.calendarSlug))
    .limit(1);

  if (cal.length === 0) return { status: 404, body: "Calendar not found" };

  const hasAccess = await checkCalendarAccess(user.id, cal[0].id, "read");
  if (!hasAccess) return { status: 403, body: "Forbidden" };

  const events = await db
    .select()
    .from(calendarEvents)
    .where(eq(calendarEvents.calendarId, cal[0].id));

  // Fetch attendees for all events
  const eventIds = events.map((e) => e.id);
  let allAttendees: (typeof calendarEventAttendees.$inferSelect)[] = [];
  if (eventIds.length > 0) {
    const { inArray } = await import("drizzle-orm");
    allAttendees = await db
      .select()
      .from(calendarEventAttendees)
      .where(inArray(calendarEventAttendees.eventId, eventIds));
  }

  const attendeesByEvent = new Map<string, typeof allAttendees>();
  for (const a of allAttendees) {
    const list = attendeesByEvent.get(a.eventId) || [];
    list.push(a);
    attendeesByEvent.set(a.eventId, list);
  }

  let responses = "";
  for (const event of events) {
    const etag = computeETag(event);
    const eventWithAttendees = {
      ...event,
      attendees: attendeesByEvent.get(event.id) || [],
    };
    const icsData = generateICalendar(cal[0].name, [eventWithAttendees]);

    responses += wrapResponse(
      `${caldavBase}/${path.principalId}/${path.calendarSlug}/${event.uid}.ics`,
      propstatOk(
        xmlTag(DAV, "getetag", etag) +
          xmlTag(CALDAV, "calendar-data", escapeXml(icsData))
      )
    );
  }

  return { status: 207, body: wrapMultistatus(responses) };
}

// ---------------------------------------------------------------------------
// GET single .ics event
// ---------------------------------------------------------------------------

export async function handleGetEvent(
  user: SessionUser,
  path: CalDAVPath
): Promise<{ status: number; body: string; headers: Record<string, string> }> {
  if (path.type !== "event" || !path.calendarSlug || !path.eventFilename) {
    return { status: 404, body: "Not found", headers: {} };
  }

  const cal = await db
    .select()
    .from(calendars)
    .where(eq(calendars.caldavSlug, path.calendarSlug))
    .limit(1);

  if (cal.length === 0) return { status: 404, body: "Calendar not found", headers: {} };

  const hasAccess = await checkCalendarAccess(user.id, cal[0].id, "read");
  if (!hasAccess) return { status: 403, body: "Forbidden", headers: {} };

  const uid = path.eventFilename.replace(/\.ics$/, "");
  const event = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.calendarId, cal[0].id),
        eq(calendarEvents.uid, uid)
      )
    )
    .limit(1);

  if (event.length === 0) return { status: 404, body: "Event not found", headers: {} };

  const attendees = await db
    .select()
    .from(calendarEventAttendees)
    .where(eq(calendarEventAttendees.eventId, event[0].id));

  const icsData = generateICalendar(cal[0].name, [
    { ...event[0], attendees },
  ]);

  const etag = computeETag(event[0]);

  return {
    status: 200,
    body: icsData,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      ETag: etag,
    },
  };
}

// ---------------------------------------------------------------------------
// PUT — create or update event from .ics
// ---------------------------------------------------------------------------

export async function handlePutEvent(
  user: SessionUser,
  path: CalDAVPath,
  body: string
): Promise<{ status: number; body: string; headers: Record<string, string> }> {
  if (path.type !== "event" || !path.calendarSlug || !path.eventFilename) {
    return { status: 404, body: "Not found", headers: {} };
  }

  const cal = await db
    .select()
    .from(calendars)
    .where(eq(calendars.caldavSlug, path.calendarSlug))
    .limit(1);

  if (cal.length === 0) return { status: 404, body: "Calendar not found", headers: {} };

  const hasAccess = await checkCalendarAccess(user.id, cal[0].id, "write");
  if (!hasAccess) return { status: 403, body: "Forbidden", headers: {} };

  const { parseICalendar } = await import("@/lib/calendar/ical");
  const parsed = parseICalendar(body);
  if (parsed.length === 0) {
    return { status: 400, body: "No VEVENT found in body", headers: {} };
  }

  const eventData = parsed[0];
  const uid = path.eventFilename.replace(/\.ics$/, "");

  // Check if event exists
  const existing = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.calendarId, cal[0].id),
        eq(calendarEvents.uid, uid)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // Update
    const [updated] = await db
      .update(calendarEvents)
      .set({
        title: eventData.title,
        description: eventData.description,
        location: eventData.location,
        startAt: eventData.startAt,
        endAt: eventData.endAt || eventData.startAt,
        allDay: eventData.allDay,
        recurrenceRule: eventData.recurrenceRule,
        recurrenceExceptions: eventData.recurrenceExceptions
          ? JSON.stringify(eventData.recurrenceExceptions)
          : "[]",
        status: eventData.status || "confirmed",
        visibility: eventData.visibility || "public",
        sequence: (eventData.sequence ?? existing[0].sequence) + 1,
        updatedAt: new Date(),
      })
      .where(eq(calendarEvents.id, existing[0].id))
      .returning();

    const etag = computeETag(updated);
    return { status: 204, body: "", headers: { ETag: etag } };
  }

  // Create
  const [created] = await db
    .insert(calendarEvents)
    .values({
      calendarId: cal[0].id,
      title: eventData.title,
      description: eventData.description,
      location: eventData.location,
      startAt: eventData.startAt,
      endAt: eventData.endAt || eventData.startAt,
      allDay: eventData.allDay,
      recurrenceRule: eventData.recurrenceRule,
      recurrenceExceptions: eventData.recurrenceExceptions
        ? JSON.stringify(eventData.recurrenceExceptions)
        : "[]",
      status: eventData.status || "confirmed",
      visibility: eventData.visibility || "public",
      sequence: eventData.sequence || 0,
      progress: eventData.progress || 0,
      uid,
      createdBy: user.id,
    })
    .returning();

  const etag = computeETag(created);
  return { status: 201, body: "", headers: { ETag: etag } };
}

// ---------------------------------------------------------------------------
// DELETE event
// ---------------------------------------------------------------------------

export async function handleDeleteEvent(
  user: SessionUser,
  path: CalDAVPath
): Promise<{ status: number; body: string }> {
  if (path.type !== "event" || !path.calendarSlug || !path.eventFilename) {
    return { status: 404, body: "Not found" };
  }

  const cal = await db
    .select()
    .from(calendars)
    .where(eq(calendars.caldavSlug, path.calendarSlug))
    .limit(1);

  if (cal.length === 0) return { status: 404, body: "Calendar not found" };

  const hasAccess = await checkCalendarAccess(user.id, cal[0].id, "write");
  if (!hasAccess) return { status: 403, body: "Forbidden" };

  const uid = path.eventFilename.replace(/\.ics$/, "");
  const deleted = await db
    .delete(calendarEvents)
    .where(
      and(
        eq(calendarEvents.calendarId, cal[0].id),
        eq(calendarEvents.uid, uid)
      )
    )
    .returning();

  if (deleted.length === 0) return { status: 404, body: "Event not found" };
  return { status: 204, body: "" };
}

// ---------------------------------------------------------------------------
// OPTIONS handler
// ---------------------------------------------------------------------------

export function handleOptions(): { status: number; headers: Record<string, string> } {
  return {
    status: 200,
    headers: {
      Allow: "OPTIONS, GET, PUT, DELETE, PROPFIND, REPORT",
      DAV: "1, 2, calendar-access",
      "Access-Control-Allow-Methods": "OPTIONS, GET, PUT, DELETE, PROPFIND, REPORT",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, Depth, If-Match, If-None-Match",
    },
  };
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  calendarEvents,
  calendarEventAttendees,
  calendarEventReminders,
} from "@/lib/db/schema";
import { eq, and, gte, lte, or } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { checkCalendarAccess } from "@/lib/calendar/permissions";
import { expandRecurrence } from "@/lib/calendar/recurrence";
import { z } from "zod";
import crypto from "crypto";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json([], { status: 401 });

  const { id: calendarId } = await params;
  const hasAccess = await checkCalendarAccess(user.id, calendarId, "read");
  if (!hasAccess) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const searchParams = request.nextUrl.searchParams;
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");

  if (!startParam || !endParam) {
    return NextResponse.json(
      { error: "Paramètres start et end requis (ISO 8601)" },
      { status: 400 }
    );
  }

  const rangeStart = new Date(startParam);
  const rangeEnd = new Date(endParam);

  if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) {
    return NextResponse.json(
      { error: "Dates invalides" },
      { status: 400 }
    );
  }

  // Fetch non-recurring events in range
  const nonRecurring = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.calendarId, calendarId),
        or(
          // Event starts within range
          and(gte(calendarEvents.startAt, rangeStart), lte(calendarEvents.startAt, rangeEnd)),
          // Event ends within range
          and(gte(calendarEvents.endAt, rangeStart), lte(calendarEvents.endAt, rangeEnd)),
          // Event spans the entire range
          and(lte(calendarEvents.startAt, rangeStart), gte(calendarEvents.endAt, rangeEnd))
        )
      )
    )
    .orderBy(calendarEvents.startAt);

  // Separate recurring and non-recurring
  const result: Array<typeof calendarEvents.$inferSelect & {
    isRecurrenceInstance?: boolean;
    recurrenceIndex?: number;
  }> = [];

  for (const event of nonRecurring) {
    if (event.recurrenceRule) {
      const exceptions = (event.recurrenceExceptions as string[]) || [];
      const expanded = expandRecurrence(
        event.recurrenceRule,
        event.startAt,
        event.endAt,
        rangeStart,
        rangeEnd,
        exceptions,
        event.id
      );

      for (const occurrence of expanded) {
        result.push({
          ...event,
          startAt: occurrence.startAt,
          endAt: occurrence.endAt,
          isRecurrenceInstance: occurrence.isRecurrenceInstance,
          recurrenceIndex: occurrence.recurrenceIndex,
        });
      }
    } else {
      result.push(event);
    }
  }

  // Also fetch recurring events that started before the range
  // (they might have occurrences within the range)
  const recurringBeforeRange = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.calendarId, calendarId),
        lte(calendarEvents.startAt, rangeStart),
        // Only those not already included
        eq(calendarEvents.recurrenceRule, calendarEvents.recurrenceRule) // non-null
      )
    );

  // Filter to only those with recurrence rules not already in result
  const existingIds = new Set(result.map((r) => r.id));
  for (const event of recurringBeforeRange) {
    if (existingIds.has(event.id) || !event.recurrenceRule) continue;

    const exceptions = (event.recurrenceExceptions as string[]) || [];
    const expanded = expandRecurrence(
      event.recurrenceRule,
      event.startAt,
      event.endAt,
      rangeStart,
      rangeEnd,
      exceptions,
      event.id
    );

    for (const occurrence of expanded) {
      result.push({
        ...event,
        startAt: occurrence.startAt,
        endAt: occurrence.endAt,
        isRecurrenceInstance: true,
        recurrenceIndex: occurrence.recurrenceIndex,
      });
    }
  }

  // Sort by startAt
  result.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  return NextResponse.json(result);
}

const createEventSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  location: z.string().max(500).optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  allDay: z.boolean().optional(),
  recurrenceRule: z.string().max(500).optional(),
  status: z.enum(["confirmed", "tentative", "cancelled"]).optional(),
  visibility: z.enum(["public", "private", "confidential"]).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  parentEventId: z.string().uuid().optional(),
  dependsOnEventId: z.string().uuid().optional(),
  progress: z.number().int().min(0).max(100).optional(),
  documentId: z.string().uuid().optional(),
  meetingRoomId: z.string().uuid().optional(),
  attendees: z.array(z.object({
    userId: z.string().uuid().optional(),
    email: z.string().email().optional(),
    displayName: z.string().optional(),
    role: z.enum(["organizer", "required", "optional"]).optional(),
  })).optional(),
  reminders: z.array(z.object({
    minutesBefore: z.number().int().min(0),
    type: z.enum(["notification", "email"]).optional(),
  })).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id: calendarId } = await params;
  const hasAccess = await checkCalendarAccess(user.id, calendarId, "write");
  if (!hasAccess) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const body = await request.json();
  const parsed = createEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { attendees, reminders, ...eventData } = parsed.data;

  // Validate dates
  const startAt = new Date(eventData.startAt);
  const endAt = new Date(eventData.endAt);
  if (endAt < startAt) {
    return NextResponse.json({ error: "La date de fin doit être après la date de début" }, { status: 400 });
  }

  // Generate iCalendar UID
  const uid = `${crypto.randomUUID()}@loriax`;

  const [event] = await db
    .insert(calendarEvents)
    .values({
      calendarId,
      title: eventData.title,
      description: eventData.description,
      location: eventData.location,
      startAt,
      endAt,
      allDay: eventData.allDay || false,
      recurrenceRule: eventData.recurrenceRule,
      status: eventData.status || "confirmed",
      visibility: eventData.visibility || "public",
      color: eventData.color,
      parentEventId: eventData.parentEventId,
      dependsOnEventId: eventData.dependsOnEventId,
      progress: eventData.progress || 0,
      documentId: eventData.documentId,
      meetingRoomId: eventData.meetingRoomId,
      uid,
      createdBy: user.id,
    })
    .returning();

  // Add attendees
  if (attendees && attendees.length > 0) {
    await db.insert(calendarEventAttendees).values(
      attendees.map((a) => ({
        eventId: event.id,
        userId: a.userId,
        email: a.email,
        displayName: a.displayName,
        role: a.role || "required" as const,
        status: "needs-action" as const,
      }))
    );
  }

  // Add organizer as attendee if not already included
  const hasOrganizer = attendees?.some(
    (a) => a.userId === user.id || a.role === "organizer"
  );
  if (!hasOrganizer) {
    await db.insert(calendarEventAttendees).values({
      eventId: event.id,
      userId: user.id,
      role: "organizer",
      status: "accepted",
    });
  }

  // Add reminders
  if (reminders && reminders.length > 0) {
    await db.insert(calendarEventReminders).values(
      reminders.map((r) => ({
        eventId: event.id,
        userId: user.id,
        type: r.type || "notification" as const,
        minutesBefore: r.minutesBefore,
      }))
    );
  }

  return NextResponse.json(event, { status: 201 });
}

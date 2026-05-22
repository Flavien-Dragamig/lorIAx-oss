import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  calendarEvents,
  calendarEventAttendees,
  calendarEventReminders,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { checkCalendarAccess } from "@/lib/calendar/permissions";
import { z } from "zod";

async function getEventWithAccess(userId: string, eventId: string, action: "read" | "write" | "admin") {
  const [event] = await db
    .select()
    .from(calendarEvents)
    .where(eq(calendarEvents.id, eventId));

  if (!event) return { event: null, error: "Événement introuvable", status: 404 };

  const hasAccess = await checkCalendarAccess(userId, event.calendarId, action);
  if (!hasAccess) return { event: null, error: "Accès refusé", status: 403 };

  return { event, error: null, status: 200 };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  const { event, error, status } = await getEventWithAccess(user.id, id, "read");
  if (!event) return NextResponse.json({ error }, { status });

  // Fetch attendees and reminders
  const attendees = await db
    .select()
    .from(calendarEventAttendees)
    .where(eq(calendarEventAttendees.eventId, id));

  const reminders = await db
    .select()
    .from(calendarEventReminders)
    .where(eq(calendarEventReminders.eventId, id));

  return NextResponse.json({ ...event, attendees, reminders });
}

const updateEventSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  location: z.string().max(500).optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  allDay: z.boolean().optional(),
  recurrenceRule: z.string().max(500).nullable().optional(),
  recurrenceExceptions: z.array(z.string()).optional(),
  status: z.enum(["confirmed", "tentative", "cancelled"]).optional(),
  visibility: z.enum(["public", "private", "confidential"]).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  parentEventId: z.string().uuid().nullable().optional(),
  dependsOnEventId: z.string().uuid().nullable().optional(),
  progress: z.number().int().min(0).max(100).optional(),
  documentId: z.string().uuid().nullable().optional(),
  calendarId: z.string().uuid().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  const { event, error, status } = await getEventWithAccess(user.id, id, "write");
  if (!event) return NextResponse.json({ error }, { status });

  const body = await request.json();
  const parsed = updateEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.location !== undefined) updates.location = parsed.data.location;
  if (parsed.data.startAt !== undefined) updates.startAt = new Date(parsed.data.startAt);
  if (parsed.data.endAt !== undefined) updates.endAt = new Date(parsed.data.endAt);
  if (parsed.data.allDay !== undefined) updates.allDay = parsed.data.allDay;
  if (parsed.data.recurrenceRule !== undefined) updates.recurrenceRule = parsed.data.recurrenceRule;
  if (parsed.data.recurrenceExceptions !== undefined) updates.recurrenceExceptions = parsed.data.recurrenceExceptions;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.visibility !== undefined) updates.visibility = parsed.data.visibility;
  if (parsed.data.color !== undefined) updates.color = parsed.data.color;
  if (parsed.data.parentEventId !== undefined) updates.parentEventId = parsed.data.parentEventId;
  if (parsed.data.dependsOnEventId !== undefined) updates.dependsOnEventId = parsed.data.dependsOnEventId;
  if (parsed.data.progress !== undefined) updates.progress = parsed.data.progress;
  if (parsed.data.documentId !== undefined) updates.documentId = parsed.data.documentId;

  // If moving to a different calendar, check write access on the target
  if (parsed.data.calendarId && parsed.data.calendarId !== event.calendarId) {
    const targetAccess = await checkCalendarAccess(user.id, parsed.data.calendarId, "write");
    if (!targetAccess) {
      return NextResponse.json({ error: "Accès refusé au calendrier cible" }, { status: 403 });
    }
    updates.calendarId = parsed.data.calendarId;
  }

  // Increment sequence for CalDAV compatibility
  updates.sequence = event.sequence + 1;

  const [updated] = await db
    .update(calendarEvents)
    .set(updates)
    .where(eq(calendarEvents.id, id))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  const { event, error, status } = await getEventWithAccess(user.id, id, "write");
  if (!event) return NextResponse.json({ error }, { status });

  const [deleted] = await db
    .delete(calendarEvents)
    .where(eq(calendarEvents.id, id))
    .returning();

  if (!deleted) return NextResponse.json({ error: "Événement introuvable" }, { status: 404 });

  return NextResponse.json({ success: true });
}

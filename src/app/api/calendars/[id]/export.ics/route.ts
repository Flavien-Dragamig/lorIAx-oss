import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendars, calendarEvents, calendarEventAttendees, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { checkCalendarAccess } from "@/lib/calendar/permissions";
import { generateICalendar } from "@/lib/calendar/ical";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  const hasAccess = await checkCalendarAccess(user.id, id, "read");
  if (!hasAccess) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const [calendar] = await db
    .select()
    .from(calendars)
    .where(eq(calendars.id, id));

  if (!calendar) return NextResponse.json({ error: "Calendrier introuvable" }, { status: 404 });

  const events = await db
    .select()
    .from(calendarEvents)
    .where(eq(calendarEvents.calendarId, id));

  // Fetch attendees for each event
  const eventsWithAttendees = await Promise.all(
    events.map(async (event) => {
      const attendees = await db
        .select({
          id: calendarEventAttendees.id,
          eventId: calendarEventAttendees.eventId,
          userId: calendarEventAttendees.userId,
          email: calendarEventAttendees.email,
          displayName: calendarEventAttendees.displayName,
          role: calendarEventAttendees.role,
          status: calendarEventAttendees.status,
          respondedAt: calendarEventAttendees.respondedAt,
        })
        .from(calendarEventAttendees)
        .leftJoin(users, eq(calendarEventAttendees.userId, users.id))
        .where(eq(calendarEventAttendees.eventId, event.id));

      return { ...event, attendees };
    })
  );

  const icsContent = generateICalendar(calendar.name, eventsWithAttendees);

  return new NextResponse(icsContent, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${calendar.caldavSlug}.ics"`,
    },
  });
}

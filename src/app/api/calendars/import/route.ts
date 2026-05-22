import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendarEvents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { checkCalendarAccess } from "@/lib/calendar/permissions";
import { parseICalendar } from "@/lib/calendar/ical";
import { z } from "zod";

const importSchema = z.object({
  calendarId: z.string().uuid(),
  icsContent: z.string().min(1),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await request.json();
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { calendarId, icsContent } = parsed.data;

  const hasAccess = await checkCalendarAccess(user.id, calendarId, "write");
  if (!hasAccess) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const parsedEvents = parseICalendar(icsContent);

  if (parsedEvents.length === 0) {
    return NextResponse.json(
      { error: "Aucun événement trouvé dans le fichier ICS" },
      { status: 400 }
    );
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const event of parsedEvents) {
    // Check for duplicate by UID
    const [existing] = await db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.uid, event.uid))
      .limit(1);

    if (existing) {
      // Update if sequence is higher or equal
      if ((event.sequence || 0) >= existing.sequence) {
        await db
          .update(calendarEvents)
          .set({
            title: event.title,
            description: event.description,
            location: event.location,
            startAt: event.startAt,
            endAt: event.endAt || event.startAt,
            allDay: event.allDay,
            recurrenceRule: event.recurrenceRule,
            recurrenceExceptions: event.recurrenceExceptions || [],
            status: event.status || "confirmed",
            visibility: event.visibility || "public",
            sequence: event.sequence || 0,
            progress: event.progress || 0,
            updatedAt: new Date(),
          })
          .where(eq(calendarEvents.id, existing.id));
        updated++;
      } else {
        skipped++;
      }
    } else {
      await db.insert(calendarEvents).values({
        calendarId,
        title: event.title,
        description: event.description,
        location: event.location,
        startAt: event.startAt,
        endAt: event.endAt || event.startAt,
        allDay: event.allDay,
        recurrenceRule: event.recurrenceRule,
        recurrenceExceptions: event.recurrenceExceptions || [],
        status: event.status || "confirmed",
        visibility: event.visibility || "public",
        uid: event.uid,
        sequence: event.sequence || 0,
        progress: event.progress || 0,
        createdBy: user.id,
      });
      created++;
    }
  }

  return NextResponse.json({
    success: true,
    created,
    updated,
    skipped,
    total: parsedEvents.length,
  });
}

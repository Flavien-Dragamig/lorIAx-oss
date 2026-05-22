import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendarEvents, calendarEventAttendees } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { z } from "zod";

const respondSchema = z.object({
  status: z.enum(["accepted", "declined", "tentative"]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id: eventId } = await params;

  // Check event exists
  const [event] = await db
    .select()
    .from(calendarEvents)
    .where(eq(calendarEvents.id, eventId));

  if (!event) return NextResponse.json({ error: "Événement introuvable" }, { status: 404 });

  const body = await request.json();
  const parsed = respondSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  // Find the attendee record for this user
  const [attendee] = await db
    .select()
    .from(calendarEventAttendees)
    .where(
      and(
        eq(calendarEventAttendees.eventId, eventId),
        eq(calendarEventAttendees.userId, user.id)
      )
    );

  if (!attendee) {
    return NextResponse.json(
      { error: "Vous n'êtes pas invité à cet événement" },
      { status: 403 }
    );
  }

  const [updated] = await db
    .update(calendarEventAttendees)
    .set({
      status: parsed.data.status,
      respondedAt: new Date(),
    })
    .where(eq(calendarEventAttendees.id, attendee.id))
    .returning();

  return NextResponse.json(updated);
}

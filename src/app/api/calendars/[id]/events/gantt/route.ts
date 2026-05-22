import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { calendarEvents, eventDependencies, tasks, users } from "@/lib/db/schema";
import { eq, and, gte, lte, or, inArray } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { checkCalendarAccess } from "@/lib/calendar/permissions";

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
    return NextResponse.json({ error: "Paramètres start et end requis" }, { status: 400 });
  }

  const rangeStart = new Date(startParam);
  const rangeEnd = new Date(endParam);

  if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) {
    return NextResponse.json({ error: "Dates invalides" }, { status: 400 });
  }

  // Fetch all events in range (non-recurring for Gantt V1)
  const events = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.calendarId, calendarId),
        or(
          and(gte(calendarEvents.startAt, rangeStart), lte(calendarEvents.startAt, rangeEnd)),
          and(gte(calendarEvents.endAt, rangeStart), lte(calendarEvents.endAt, rangeEnd)),
          and(lte(calendarEvents.startAt, rangeStart), gte(calendarEvents.endAt, rangeEnd))
        )
      )
    )
    .orderBy(calendarEvents.startAt);

  // Fetch dependencies for these events
  const eventIds = events.map((e) => e.id);
  let deps: (typeof eventDependencies.$inferSelect)[] = [];
  if (eventIds.length > 0) {
    deps = await db
      .select()
      .from(eventDependencies)
      .where(
        or(
          inArray(eventDependencies.sourceEventId, eventIds),
          inArray(eventDependencies.targetEventId, eventIds)
        )
      );
  }

  // Charger les assignataires depuis la table tasks
  const assigneeMap = new Map<string, { id: string; name: string; email: string; avatarUrl: string | null }>();
  if (eventIds.length > 0) {
    const assigneeRows = await db
      .select({
        calendarEventId: tasks.calendarEventId,
        userId: users.id,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
      })
      .from(tasks)
      .innerJoin(users, eq(tasks.assigneeId, users.id))
      .where(
        and(
          eq(tasks.kind, "gantt_event"),
          inArray(tasks.calendarEventId, eventIds)
        )
      );

    for (const row of assigneeRows) {
      if (row.calendarEventId) {
        assigneeMap.set(row.calendarEventId, {
          id: row.userId,
          name: row.name,
          email: row.email,
          avatarUrl: row.avatarUrl,
        });
      }
    }
  }

  // Build dependencies map: targetEventId → sourceEventId[]
  const depsMap = new Map<string, string[]>();
  for (const d of deps) {
    const arr = depsMap.get(d.targetEventId) || [];
    arr.push(d.sourceEventId);
    depsMap.set(d.targetEventId, arr);
  }

  const ganttEvents = events.map((e) => ({
    id: e.id,
    title: e.title,
    startAt: e.startAt.toISOString(),
    endAt: e.endAt.toISOString(),
    allDay: e.allDay,
    color: e.color,
    progress: e.progress,
    parentEventId: e.parentEventId,
    dependencies: depsMap.get(e.id) || [],
    assigneeId: assigneeMap.get(e.id)?.id ?? null,
    assignee: assigneeMap.get(e.id) ?? null,
  }));

  return NextResponse.json({ events: ganttEvents });
}

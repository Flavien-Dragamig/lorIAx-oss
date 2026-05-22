import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  userStatus,
  users,
  teams,
  teamMembers,
  calendarEvents,
  calendars,
} from "@/lib/db/schema";
import { eq, and, inArray, lte, gte } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { getOrgSlugFromHeaders, getOrgId } from "@/lib/org/get-org-id";
import { headers } from "next/headers";
import { computeDayAvailability } from "@/lib/presence/availability";

function deriveEffectiveStatus(
  userId: string,
  persistedStatus: string,
  lastSeen: Date,
  inMeetingNow: Set<string>
): string {
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
  if (lastSeen < tenMinAgo) return "offline";
  if (persistedStatus !== "dnd" && inMeetingNow.has(userId)) return "in_meeting";
  return persistedStatus;
}

export async function GET() {
  const currentUser = await getSessionUser();
  if (!currentUser) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const orgSlug = await getOrgSlugFromHeaders(headers);
  const orgId = await getOrgId(orgSlug);

  // Trouver les équipes de l'utilisateur courant
  const myTeams = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(
      and(
        eq(teamMembers.userId, currentUser.id),
        eq(teams.organizationId, orgId)
      )
    );

  let memberIds: string[] = [];

  if (myTeams.length > 0) {
    const teamIds = myTeams.map((t) => t.teamId);
    const membersRaw = await db
      .selectDistinct({ userId: teamMembers.userId })
      .from(teamMembers)
      .where(inArray(teamMembers.teamId, teamIds));
    memberIds = membersRaw
      .map((m) => m.userId)
      .filter((id) => id !== currentUser.id);
  }

  // Fallback : aucune équipe ou aucun coéquipier → afficher tous les utilisateurs du système
  if (memberIds.length === 0) {
    const allUsers = await db.select({ userId: users.id }).from(users);
    memberIds = allUsers.map((u) => u.userId).filter((id) => id !== currentUser.id);
  }

  if (memberIds.length === 0) {
    return NextResponse.json({ members: [] });
  }

  // Infos utilisateurs + statuts
  const memberUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(inArray(users.id, memberIds));

  const statuses = await db
    .select()
    .from(userStatus)
    .where(inArray(userStatus.userId, memberIds));

  const statusMap = new Map(statuses.map((s) => [s.userId, s]));

  // Calculer la disponibilité sur 3 jours
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const days = [
    new Date(today),
    new Date(today.getTime() + 86400000),
    new Date(today.getTime() + 2 * 86400000),
  ];

  const rangeStart = days[0];
  const rangeEnd = new Date(days[2].getTime() + 86400000);

  // Charger les événements CalDAV des 3 prochains jours pour tous les membres
  const events = await db
    .select({
      calendarOwnerUserId: calendars.ownerUserId,
      startAt: calendarEvents.startAt,
      endAt: calendarEvents.endAt,
      allDay: calendarEvents.allDay,
    })
    .from(calendarEvents)
    .innerJoin(calendars, eq(calendarEvents.calendarId, calendars.id))
    .where(
      and(
        inArray(calendars.ownerUserId, memberIds),
        lte(calendarEvents.startAt, rangeEnd),
        gte(calendarEvents.endAt, rangeStart)
      )
    );

  const eventsByUser = new Map<string, typeof events>();
  for (const ev of events) {
    if (!ev.calendarOwnerUserId) continue;
    const list = eventsByUser.get(ev.calendarOwnerUserId) ?? [];
    list.push(ev);
    eventsByUser.set(ev.calendarOwnerUserId, list);
  }

  // Charger les membres en réunion à l'instant T (batch, non N+1)
  const now = new Date();
  const currentMeetings = await db
    .select({ userId: calendars.ownerUserId })
    .from(calendarEvents)
    .innerJoin(calendars, eq(calendarEvents.calendarId, calendars.id))
    .where(
      and(
        inArray(calendars.ownerUserId, memberIds),
        lte(calendarEvents.startAt, now),
        gte(calendarEvents.endAt, now),
        eq(calendarEvents.allDay, false)
      )
    );

  const inMeetingNow = new Set(
    currentMeetings.map((m) => m.userId).filter((id): id is string => id !== null)
  );

  const members = memberUsers.map((u) => {
      const row = statusMap.get(u.id);
      const lastSeen = row?.lastSeen ?? new Date(0);
      const persistedStatus = row?.status ?? "offline";
      const effectiveStatus = deriveEffectiveStatus(u.id, persistedStatus, lastSeen, inMeetingNow);
      const customExpired = row?.customExpiresAt && row.customExpiresAt < new Date();

      const userEvents = (eventsByUser.get(u.id) ?? []).map((e) => ({
        startAt: e.startAt,
        endAt: e.endAt,
        allDay: e.allDay,
      }));

      const availability = days.map((d) => computeDayAvailability(d, userEvents));

      return {
        userId: u.id,
        name: u.name ?? u.email,
        email: u.email,
        avatarUrl: u.avatarUrl ?? null,
        effectiveStatus,
        customEmoji: customExpired ? null : (row?.customEmoji ?? null),
        customText: customExpired ? null : (row?.customText ?? null),
        lastSeen: lastSeen.toISOString(),
        availability,
      };
    });

  // Trier : online/away en premier, puis in_meeting, dnd, offline
  const order = ["online", "away", "in_meeting", "dnd", "offline"];
  members.sort(
    (a, b) => order.indexOf(a.effectiveStatus) - order.indexOf(b.effectiveStatus)
  );

  return NextResponse.json({ members });
}

import { db } from "@/lib/db";
import { meetings, meetingParticipants, documents, spaces, users, calendarEvents, calendarEventAttendees } from "@/lib/db/schema";
import { eq, desc, and, or, inArray } from "drizzle-orm";
import { getSpacePermission } from "@/lib/auth/check-access";
import { hasGlobalRole } from "@/lib/auth/rbac";
import crypto from "crypto";

/**
 * Generate an auto-title for a meeting based on its context.
 * Format: YYYY-MM-DD_space-slug_document-slug
 */
export async function generateAutoTitle(
  spaceId: string,
  documentId?: string
): Promise<string> {
  const date = new Date().toISOString().slice(0, 10);

  const [space] = await db
    .select({ name: spaces.name, slug: spaces.slug })
    .from(spaces)
    .where(eq(spaces.id, spaceId))
    .limit(1);

  if (!space) return `${date}_reunion`;

  const spaceSlug = space.slug;

  if (!documentId) return `${date}_${spaceSlug}`;

  const [doc] = await db
    .select({ title: documents.title, slug: documents.slug })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  if (!doc) return `${date}_${spaceSlug}`;

  return `${date}_${spaceSlug}_${doc.slug}`;
}

/**
 * Generate a URL-safe room name from a title.
 */
function generateRoomName(title: string): string {
  const date = new Date().toISOString().slice(0, 10); // yyyy-mm-dd
  const slug = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  const suffix = crypto.randomBytes(3).toString("hex"); // 6 chars
  return `${date}_${slug}_${suffix}`;
}

interface CreateMeetingInput {
  title: string;
  spaceId: string;
  documentId?: string;
  createdBy: string;
  mode: "immediate" | "scheduled";
  meetingType?: "video" | "in_person";
  scheduledAt?: string; // ISO 8601
  calendarId?: string;
  attendeeUserIds?: string[];
}

export async function createMeeting(input: CreateMeetingInput) {
  const roomName = generateRoomName(input.title);
  const now = new Date();

  const isImmediate = input.mode === "immediate";

  const [meeting] = await db
    .insert(meetings)
    .values({
      title: input.title,
      roomName,
      spaceId: input.spaceId,
      documentId: input.documentId || null,
      createdBy: input.createdBy,
      meetingType: input.meetingType ?? "video",
      status: isImmediate ? "active" : "scheduled",
      startedAt: isImmediate ? now : null,
      scheduledAt: isImmediate ? null : input.scheduledAt ? new Date(input.scheduledAt) : null,
    })
    .returning();

  // If scheduled and a calendarId is provided, create linked calendar event
  if (!isImmediate && input.calendarId && input.scheduledAt) {
    const startAt = new Date(input.scheduledAt);
    const endAt = new Date(startAt.getTime() + 60 * 60 * 1000); // 1h default
    const uid = `${crypto.randomUUID()}@loriax`;

    const [event] = await db
      .insert(calendarEvents)
      .values({
        calendarId: input.calendarId,
        title: input.title,
        startAt,
        endAt,
        uid,
        meetingId: meeting.id,
        createdBy: input.createdBy,
      })
      .returning();

    // Link meeting to event
    await db
      .update(meetings)
      .set({ calendarEventId: event.id, updatedAt: now })
      .where(eq(meetings.id, meeting.id));

    // Add organizer as attendee
    await db.insert(calendarEventAttendees).values({
      eventId: event.id,
      userId: input.createdBy,
      role: "organizer",
      status: "accepted",
    });

    // Add invited participants
    if (input.attendeeUserIds?.length) {
      await db.insert(calendarEventAttendees).values(
        input.attendeeUserIds.map((userId) => ({
          eventId: event.id,
          userId,
          role: "required" as const,
          status: "needs-action" as const,
        }))
      );
    }

    return { ...meeting, calendarEventId: event.id };
  }

  return meeting;
}

export async function getMeeting(id: string) {
  const [meeting] = await db
    .select()
    .from(meetings)
    .where(eq(meetings.id, id));
  return meeting || null;
}

export async function getMeetingByRoomName(roomName: string) {
  const [meeting] = await db
    .select()
    .from(meetings)
    .where(eq(meetings.roomName, roomName));
  return meeting || null;
}

export async function listMeetings(userId: string, limit = 20) {
  // Include meetings the user created OR participated in
  const participatedMeetingIds = db
    .select({ meetingId: meetingParticipants.meetingId })
    .from(meetingParticipants)
    .where(eq(meetingParticipants.userId, userId));

  const result = await db
    .select({
      id: meetings.id,
      title: meetings.title,
      roomName: meetings.roomName,
      spaceId: meetings.spaceId,
      documentId: meetings.documentId,
      notesDocumentId: meetings.notesDocumentId,
      status: meetings.status,
      recordingPath: meetings.recordingPath,
      transcriptPath: meetings.transcriptPath,
      startedAt: meetings.startedAt,
      endedAt: meetings.endedAt,
      scheduledAt: meetings.scheduledAt,
      createdBy: meetings.createdBy,
      createdAt: meetings.createdAt,
      updatedAt: meetings.updatedAt,
      spaceSlug: spaces.slug,
    })
    .from(meetings)
    .leftJoin(spaces, eq(meetings.spaceId, spaces.id))
    .where(
      or(
        eq(meetings.createdBy, userId),
        inArray(meetings.id, participatedMeetingIds)
      )
    )
    .orderBy(desc(meetings.createdAt))
    .limit(limit);
  return result;
}

export async function updateMeetingTitle(id: string, title: string) {
  const [updated] = await db
    .update(meetings)
    .set({ title, updatedAt: new Date() })
    .where(eq(meetings.id, id))
    .returning();
  return updated;
}

export async function updateMeetingStatus(
  id: string,
  status: typeof meetings.$inferInsert.status,
  extra?: Partial<typeof meetings.$inferInsert>
) {
  const [updated] = await db
    .update(meetings)
    .set({ status, updatedAt: new Date(), ...extra })
    .where(eq(meetings.id, id))
    .returning();

  // Sync calendar event status
  if (updated?.calendarEventId) {
    let eventStatus: "confirmed" | "cancelled" | undefined;
    if (status === "active") eventStatus = "confirmed";
    if (status === "failed") eventStatus = "cancelled";

    if (eventStatus) {
      await db
        .update(calendarEvents)
        .set({ status: eventStatus, updatedAt: new Date() })
        .where(eq(calendarEvents.id, updated.calendarEventId));
    }
  }

  return updated;
}

export async function addParticipant(
  meetingId: string,
  userId: string | null,
  displayName: string
) {
  const [participant] = await db
    .insert(meetingParticipants)
    .values({
      meetingId,
      userId,
      displayName,
      joinedAt: new Date(),
    })
    .returning();
  return participant;
}

export async function getMeetingParticipants(meetingId: string) {
  return db
    .select()
    .from(meetingParticipants)
    .where(eq(meetingParticipants.meetingId, meetingId));
}

export async function deleteMeeting(id: string) {
  // Get meeting to check for linked calendar event
  const [meeting] = await db
    .select({ calendarEventId: meetings.calendarEventId })
    .from(meetings)
    .where(eq(meetings.id, id))
    .limit(1);

  // Cancel linked calendar event if exists
  if (meeting?.calendarEventId) {
    await db
      .update(calendarEvents)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(calendarEvents.id, meeting.calendarEventId));
  }

  // meetingParticipants has onDelete: "cascade", no manual cleanup needed
  const [deleted] = await db
    .delete(meetings)
    .where(eq(meetings.id, id))
    .returning();
  return deleted || null;
}

/**
 * Check if a user can access a meeting.
 * Allowed: creator, participant, space admin, or super_admin.
 */
export async function canAccessMeeting(
  userId: string,
  meeting: { id: string; createdBy: string | null; spaceId: string | null }
): Promise<boolean> {
  // Creator
  if (meeting.createdBy === userId) return true;

  // Participant
  const [participant] = await db
    .select({ id: meetingParticipants.id })
    .from(meetingParticipants)
    .where(
      and(
        eq(meetingParticipants.meetingId, meeting.id),
        eq(meetingParticipants.userId, userId)
      )
    )
    .limit(1);
  if (participant) return true;

  // Super admin
  const [user] = await db
    .select({ globalRole: users.globalRole })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (user && hasGlobalRole(user.globalRole, "admin")) return true;

  // Space admin
  if (meeting.spaceId) {
    const perm = await getSpacePermission(userId, meeting.spaceId);
    if (perm === "admin") return true;
  }

  return false;
}

export async function getMeetingWithNotes(meetingId: string) {
  const [meeting] = await db
    .select()
    .from(meetings)
    .where(eq(meetings.id, meetingId))
    .limit(1);

  if (!meeting || !meeting.notesDocumentId) return null;

  const [doc] = await db
    .select({
      id: documents.id,
      title: documents.title,
      content: documents.contentText,
      spaceId: documents.spaceId,
    })
    .from(documents)
    .where(eq(documents.id, meeting.notesDocumentId))
    .limit(1);

  if (!doc || !doc.spaceId) return null;

  const [space] = await db
    .select({ slug: spaces.slug })
    .from(spaces)
    .where(eq(spaces.id, doc.spaceId))
    .limit(1);

  if (!space) return null;

  return {
    documentId: doc.id,
    title: doc.title,
    content: doc.content ?? "",
    spaceSlug: space.slug,
  };
}

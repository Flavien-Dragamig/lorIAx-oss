import { db } from "@/lib/db";
import {
  calendarEvents,
  calendarEventReminders,
  calendarEventAttendees,
} from "@/lib/db/schema";
import { eq, and, gte } from "drizzle-orm";
import { createNotification, createNotifications } from "@/lib/notifications";
import logger from "@/lib/logger";

/**
 * Send calendar invitation notifications to all attendees of an event.
 */
export async function notifyEventInvitation(
  eventId: string,
  organizerUserId: string,
  organizerName: string
): Promise<void> {
  const event = await db
    .select()
    .from(calendarEvents)
    .where(eq(calendarEvents.id, eventId))
    .limit(1);

  if (event.length === 0) return;
  const ev = event[0];

  const attendees = await db
    .select()
    .from(calendarEventAttendees)
    .where(
      and(
        eq(calendarEventAttendees.eventId, eventId),
        // Exclude organizer
      )
    );

  const userIds = attendees
    .filter((a) => a.userId && a.userId !== organizerUserId)
    .map((a) => a.userId!);

  if (userIds.length === 0) return;

  const startDate = new Date(ev.startAt);
  const dateStr = startDate.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

  await createNotifications(userIds, {
    type: "calendar_invitation",
    title: `Invitation : ${ev.title}`,
    message: `${organizerName} vous invite à "${ev.title}" le ${dateStr}`,
    actorId: organizerUserId,
  });
}

/**
 * Process pending event reminders.
 * Should be called periodically (e.g., every minute via cron).
 */
export async function processReminders(): Promise<number> {
  const now = new Date();

  // Find all unsent reminders where the event is upcoming
  const pendingReminders = await db
    .select({
      reminderId: calendarEventReminders.id,
      userId: calendarEventReminders.userId,
      minutesBefore: calendarEventReminders.minutesBefore,
      eventId: calendarEventReminders.eventId,
      eventTitle: calendarEvents.title,
      eventStartAt: calendarEvents.startAt,
      eventLocation: calendarEvents.location,
    })
    .from(calendarEventReminders)
    .innerJoin(
      calendarEvents,
      eq(calendarEvents.id, calendarEventReminders.eventId)
    )
    .where(
      and(
        eq(calendarEventReminders.sent, false),
        // Event is in the future
        gte(calendarEvents.startAt, now)
      )
    );

  let sent = 0;

  for (const reminder of pendingReminders) {
    const triggerTime = new Date(
      new Date(reminder.eventStartAt).getTime() -
        reminder.minutesBefore * 60 * 1000
    );

    // If we've passed the trigger time, send the reminder
    if (now >= triggerTime) {
      const startDate = new Date(reminder.eventStartAt);
      const dateStr = startDate.toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      });

      try {
        await createNotification({
          userId: reminder.userId,
          type: "calendar_reminder",
          title: `Rappel : ${reminder.eventTitle}`,
          message: `"${reminder.eventTitle}" commence le ${dateStr}${
            reminder.eventLocation ? ` à ${reminder.eventLocation}` : ""
          }`,
        });

        // Mark as sent
        await db
          .update(calendarEventReminders)
          .set({ sent: true, sentAt: now })
          .where(eq(calendarEventReminders.id, reminder.reminderId));

        sent++;
      } catch (err) {
        logger.error(
          { err, reminderId: reminder.reminderId },
          "[calendar] Erreur envoi rappel"
        );
      }
    }
  }

  return sent;
}

/**
 * Send webhook event for calendar actions.
 */
export async function dispatchCalendarWebhook(
  eventType: "event.created" | "event.updated" | "event.deleted" | "event.responded",
  payload: Record<string, unknown>,
  actorUserId: string
): Promise<void> {
  try {
    const { dispatchWebhookEvent } = await import("@/lib/webhooks/dispatch");
    await dispatchWebhookEvent(eventType as Parameters<typeof dispatchWebhookEvent>[0], payload, actorUserId);
  } catch {
    // Webhooks module may not be available
  }
}

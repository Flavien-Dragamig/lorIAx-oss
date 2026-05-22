import { db } from "@/lib/db";
import { notifications, users, documents, spaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sendEmail } from "@/lib/email/send";
import { notificationEmail } from "@/lib/email/templates/notification";
import logger from "@/lib/logger";

type NotificationType = "mention" | "comment" | "reply" | "share" | "calendar_reminder" | "calendar_invitation" | "task_assigned";

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  documentId?: string;
  actorId?: string;
}

/**
 * Send an email notification in the background (fire-and-forget).
 */
async function sendNotificationEmail(params: CreateNotificationParams) {
  try {
    // Fetch user email + name
    const [user] = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, params.userId))
      .limit(1);
    if (!user) return;

    // Fetch actor name
    let actorName = "Quelqu'un";
    if (params.actorId) {
      const [actor] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, params.actorId))
        .limit(1);
      if (actor) actorName = actor.name;
    }

    // Fetch document title
    let documentTitle = "un document";
    let documentUrl = "/";
    if (params.documentId) {
      const [doc] = await db
        .select({ title: documents.title, spaceSlug: spaces.slug })
        .from(documents)
        .leftJoin(spaces, eq(documents.spaceId, spaces.id))
        .where(eq(documents.id, params.documentId))
        .limit(1);
      if (doc) {
        documentTitle = doc.title;
        const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        if (doc.spaceSlug) {
          documentUrl = `${baseUrl}/s/${doc.spaceSlug}/${params.documentId}`;
        }
      }
    }

    const template = notificationEmail({
      userName: user.name,
      actorName,
      type: params.type,
      documentTitle,
      documentUrl,
      message: params.message || undefined,
    });

    await sendEmail({
      to: user.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  } catch (err) {
    // Email is best-effort, don't fail the notification
    logger.error({ err }, "[notification-email] Erreur envoi email de notification");
  }
}

/**
 * Create a notification for a single user.
 * Silently skips if userId === actorId (no self-notification).
 */
export async function createNotification(params: CreateNotificationParams) {
  // Don't notify yourself
  if (params.actorId && params.userId === params.actorId) return;

  await db.insert(notifications).values({
    userId: params.userId,
    type: params.type,
    title: params.title,
    message: params.message || null,
    documentId: params.documentId || null,
    actorId: params.actorId || null,
  });

  // Send email notification in the background
  sendNotificationEmail(params);
}

/**
 * Create notifications for multiple users at once.
 */
export async function createNotifications(
  userIds: string[],
  params: Omit<CreateNotificationParams, "userId">
) {
  // Filter out the actor (no self-notification) and deduplicate
  const uniqueIds = [...new Set(userIds)].filter(
    (id) => id !== params.actorId
  );

  if (uniqueIds.length === 0) return;

  await db.insert(notifications).values(
    uniqueIds.map((userId) => ({
      userId,
      type: params.type,
      title: params.title,
      message: params.message || null,
      documentId: params.documentId || null,
      actorId: params.actorId || null,
    }))
  );

  // Send email notifications in the background
  for (const userId of uniqueIds) {
    sendNotificationEmail({ ...params, userId });
  }
}

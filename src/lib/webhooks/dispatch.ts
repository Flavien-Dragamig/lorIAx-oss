import { createHmac, randomUUID } from "crypto";
import { db } from "@/lib/db";
import logger from "@/lib/logger";
import { webhooks, webhookDeliveries, users } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

const MAX_FAILURES = 10;
const RETRY_DELAYS = [10_000, 60_000, 300_000]; // 10s, 60s, 5min

export type WebhookEventType =
  | "document.created"
  | "document.updated"
  | "document.deleted"
  | "comment.created"
  | "comment.resolved"
  | "space.member_added"
  | "space.member_removed"
  | "mention.created"
  | "share.created"
  | "share.revoked";

interface WebhookPayload {
  id: string;
  event: WebhookEventType;
  timestamp: string;
  actor: { id: string; email: string; name: string };
  data: Record<string, unknown>;
}

/**
 * Sign a payload with HMAC-SHA256.
 */
function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Dispatch a webhook event to all matching active webhooks.
 * Non-blocking — errors are caught and logged.
 */
export async function dispatchWebhookEvent(
  eventType: WebhookEventType,
  data: Record<string, unknown>,
  actorUserId: string
): Promise<void> {
  // Fire and forget
  doDispatch(eventType, data, actorUserId).catch((err) => {
    logger.error({ err }, "[webhook] Dispatch error");
  });
}

async function doDispatch(
  eventType: WebhookEventType,
  data: Record<string, unknown>,
  actorUserId: string
): Promise<void> {
  // Get actor info
  const [actor] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, actorUserId))
    .limit(1);

  if (!actor) return;

  // Find matching active webhooks
  const spaceId = data.spaceId as string | undefined;

  const activeWebhooks = await db
    .select()
    .from(webhooks)
    .where(
      and(
        eq(webhooks.active, true),
        sql`${webhooks.failureCount} < ${MAX_FAILURES}`
      )
    );

  // Filter by event type and optionally by spaceId
  const matching = activeWebhooks.filter((wh) => {
    const events = (wh.events as string[]) || [];
    if (!events.includes(eventType)) return false;
    if (wh.spaceId && spaceId && wh.spaceId !== spaceId) return false;
    return true;
  });

  if (matching.length === 0) return;

  const payload: WebhookPayload = {
    id: randomUUID(),
    event: eventType,
    timestamp: new Date().toISOString(),
    actor: { id: actor.id, email: actor.email, name: actor.name },
    data,
  };

  // Deliver to each webhook
  for (const wh of matching) {
    deliverWebhook(wh, payload);
  }
}

async function deliverWebhook(
  webhook: typeof webhooks.$inferSelect,
  payload: WebhookPayload,
  attempt = 1
): Promise<void> {
  const payloadStr = JSON.stringify(payload);
  const signature = signPayload(payloadStr, webhook.secret);

  let statusCode: number | null = null;
  let responseBody: string | null = null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-LorIAx-Signature": `sha256=${signature}`,
        "X-LorIAx-Event": payload.event,
        "X-LorIAx-Delivery": payload.id,
        "User-Agent": "LorIAx-Webhook/1.0",
      },
      body: payloadStr,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    statusCode = response.status;
    responseBody = await response.text().catch(() => null);

    if (response.ok) {
      // Success — reset failure count
      await db
        .update(webhooks)
        .set({ failureCount: 0 })
        .where(eq(webhooks.id, webhook.id));

      await db.insert(webhookDeliveries).values({
        webhookId: webhook.id,
        eventType: payload.event,
        payload,
        statusCode,
        responseBody,
        attempts: attempt,
        deliveredAt: new Date(),
      });
      return;
    }
  } catch (err: unknown) {
    responseBody = (err instanceof Error ? err.message : null) || "Connection error";
  }

  // Failure — increment failure count
  const newFailureCount = (webhook.failureCount || 0) + 1;
  const shouldDeactivate = newFailureCount >= MAX_FAILURES;

  await db
    .update(webhooks)
    .set({
      failureCount: newFailureCount,
      ...(shouldDeactivate ? { active: false } : {}),
    })
    .where(eq(webhooks.id, webhook.id));

  // Record delivery attempt
  const retryDelay = RETRY_DELAYS[attempt - 1];
  const nextRetryAt = retryDelay && !shouldDeactivate
    ? new Date(Date.now() + retryDelay)
    : null;

  await db.insert(webhookDeliveries).values({
    webhookId: webhook.id,
    eventType: payload.event,
    payload,
    statusCode,
    responseBody,
    attempts: attempt,
    nextRetryAt,
  });

  // Retry if possible
  if (nextRetryAt && attempt < RETRY_DELAYS.length + 1) {
    setTimeout(() => {
      deliverWebhook(webhook, payload, attempt + 1);
    }, retryDelay);
  }
}

import { db } from "@/lib/db";
import { webhooks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { authenticateApiRequest, requireScope } from "@/lib/api/auth-api";
import { apiSuccess, apiError } from "@/lib/api/response";
import { z } from "zod";
import { randomBytes } from "crypto";

const WEBHOOK_EVENTS = [
  "document.created",
  "document.updated",
  "document.deleted",
  "comment.created",
  "comment.resolved",
  "space.member_added",
  "space.member_removed",
  "mention.created",
] as const;

const createSchema = z.object({
  url: z.string().url().max(2048),
  events: z.array(z.enum(WEBHOOK_EVENTS as unknown as [string, ...string[]])).min(1),
  spaceId: z.string().uuid().optional(),
});

const _updateSchema = z.object({
  url: z.string().url().max(2048).optional(),
  events: z.array(z.enum(WEBHOOK_EVENTS as unknown as [string, ...string[]])).min(1).optional(),
  active: z.boolean().optional(),
});

/**
 * GET /api/v1/webhooks — List user's webhooks.
 */
export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if ("error" in auth) return auth.error;

  const scopeErr = requireScope(auth.user, "webhooks");
  if (scopeErr) return scopeErr;

  const results = await db
    .select({
      id: webhooks.id,
      url: webhooks.url,
      events: webhooks.events,
      spaceId: webhooks.spaceId,
      active: webhooks.active,
      failureCount: webhooks.failureCount,
      createdAt: webhooks.createdAt,
      updatedAt: webhooks.updatedAt,
    })
    .from(webhooks)
    .where(eq(webhooks.userId, auth.user.id))
    .orderBy(webhooks.createdAt);

  return apiSuccess(results);
}

/**
 * POST /api/v1/webhooks — Create a webhook.
 */
export async function POST(request: Request) {
  const auth = await authenticateApiRequest(request);
  if ("error" in auth) return auth.error;

  const scopeErr = requireScope(auth.user, "webhooks");
  if (scopeErr) return scopeErr;

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Données invalides", 400);
  }

  // Limit: 20 webhooks per user
  const existing = await db
    .select({ id: webhooks.id })
    .from(webhooks)
    .where(eq(webhooks.userId, auth.user.id));

  if (existing.length >= 20) {
    return apiError("Limite de 20 webhooks atteinte", 400);
  }

  const secret = randomBytes(32).toString("hex");

  const [created] = await db
    .insert(webhooks)
    .values({
      userId: auth.user.id,
      url: parsed.data.url,
      events: parsed.data.events,
      spaceId: parsed.data.spaceId || null,
      secret,
    })
    .returning();

  return apiSuccess(
    {
      ...created,
      secret, // Shown once at creation
    },
    undefined,
    201
  );
}

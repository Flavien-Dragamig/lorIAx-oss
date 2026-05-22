import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userStatus, calendarEvents, calendars } from "@/lib/db/schema";
import { eq, and, lte, gte } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/get-user";
import { z } from "zod";

const patchSchema = z.object({
  status: z.enum(["online", "away", "in_meeting", "dnd"]).optional(),
  custom_emoji: z.string().max(10).nullable().optional(),
  custom_text: z.string().max(100).nullable().optional(),
  custom_expires_at: z.string().datetime({ offset: true }).nullable().optional(),
});

async function computeEffectiveStatus(
  userId: string,
  persistedStatus: string,
  lastSeen: Date
): Promise<string> {
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
  if (lastSeen < tenMinAgo) return "offline";

  if (persistedStatus !== "dnd") {
    const now = new Date();
    const inMeeting = await db
      .select({ id: calendarEvents.id })
      .from(calendarEvents)
      .innerJoin(calendars, eq(calendarEvents.calendarId, calendars.id))
      .where(
        and(
          eq(calendars.ownerUserId, userId),
          lte(calendarEvents.startAt, now),
          gte(calendarEvents.endAt, now),
          eq(calendarEvents.allDay, false)
        )
      )
      .limit(1);
    if (inMeeting.length > 0) return "in_meeting";
  }

  return persistedStatus;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const [row] = await db
    .select()
    .from(userStatus)
    .where(eq(userStatus.userId, user.id))
    .limit(1);

  if (!row) {
    return NextResponse.json({
      status: "offline",
      effectiveStatus: "offline",
      customEmoji: null,
      customText: null,
      customExpiresAt: null,
      lastSeen: new Date().toISOString(),
    });
  }

  const effectiveStatus = await computeEffectiveStatus(user.id, row.status, row.lastSeen);
  const customExpired = row.customExpiresAt && row.customExpiresAt < new Date();

  return NextResponse.json({
    status: row.status,
    effectiveStatus,
    customEmoji: customExpired ? null : row.customEmoji,
    customText: customExpired ? null : row.customText,
    customExpiresAt: customExpired ? null : (row.customExpiresAt?.toISOString() ?? null),
    lastSeen: row.lastSeen.toISOString(),
  });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  let body: z.infer<typeof patchSchema> = {};
  try {
    const text = await req.text();
    if (text) body = patchSchema.parse(JSON.parse(text));
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const now = new Date();
  await db
    .insert(userStatus)
    .values({
      userId: user.id,
      status: body.status ?? "online",
      customEmoji: body.custom_emoji ?? null,
      customText: body.custom_text ?? null,
      customExpiresAt: body.custom_expires_at ? new Date(body.custom_expires_at) : null,
      lastSeen: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userStatus.userId,
      set: {
        ...(body.status !== undefined && { status: body.status }),
        ...(body.custom_emoji !== undefined && { customEmoji: body.custom_emoji }),
        ...(body.custom_text !== undefined && { customText: body.custom_text }),
        ...(body.custom_expires_at !== undefined && {
          customExpiresAt: body.custom_expires_at ? new Date(body.custom_expires_at) : null,
        }),
        lastSeen: now,
        updatedAt: now,
      },
    });

  const [updated] = await db
    .select()
    .from(userStatus)
    .where(eq(userStatus.userId, user.id))
    .limit(1);

  const effectiveStatus = await computeEffectiveStatus(user.id, updated.status, updated.lastSeen);
  const customExpired = updated.customExpiresAt && updated.customExpiresAt < new Date();

  return NextResponse.json({
    status: updated.status,
    effectiveStatus,
    customEmoji: customExpired ? null : updated.customEmoji,
    customText: customExpired ? null : updated.customText,
    customExpiresAt: customExpired ? null : (updated.customExpiresAt?.toISOString() ?? null),
    lastSeen: updated.lastSeen.toISOString(),
  });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, spaces, publicShares, meetings } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";
import { generateLiveKitToken } from "@/lib/meet/livekit-token";
import { z } from "zod";
import logger from "@/lib/logger";
import { checkRateLimitAsync, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";

// ─── Validation Schema ──────────────────────────────────────────────────────

const guestTokenSchema = z.object({
  shareToken: z.string().min(1).max(64),
  roomName: z.string().min(1).max(100),
  displayName: z.string().min(1).max(50).trim(),
});

type GuestTokenRequest = z.infer<typeof guestTokenSchema>;

// ─── Display Name Sanitization ──────────────────────────────────────────────

function sanitizeDisplayName(name: string): string {
  return name
    .trim()
    .substring(0, 50)
    .replace(/[\u0000-\u001f]/g, "");
}

// ─── POST Handler ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Rate limit by IP
    const clientIp = getClientIp(request);
    const rateLimitResult = await checkRateLimitAsync(
      `guest_meet:${clientIp}`,
      RATE_LIMITS.meet
    );

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)),
          },
        }
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON" },
        { status: 400 }
      );
    }

    let validatedBody: GuestTokenRequest;
    try {
      validatedBody = guestTokenSchema.parse(body);
    } catch {
      return NextResponse.json(
        { error: "Not found" },
        { status: 404 }
      );
    }

    const { shareToken, roomName, displayName } = validatedBody;
    const sanitizedDisplayName = sanitizeDisplayName(displayName);

    // ─── Verification 1: Find public share by token ─────────────────────────

    const [share] = await db
      .select()
      .from(publicShares)
      .where(
        and(
          eq(publicShares.token, shareToken),
          isNull(publicShares.revokedAt)
        )
      )
      .limit(1);

    if (!share) {
      return NextResponse.json(
        { error: "Not found" },
        { status: 404 }
      );
    }

    // ─── Verification 2: Check expiration ───────────────────────────────────

    if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: "Not found" },
        { status: 404 }
      );
    }

    // ─── Verification 3: Load document ──────────────────────────────────────

    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, share.documentId))
      .limit(1);

    if (!doc) {
      return NextResponse.json(
        { error: "Not found" },
        { status: 404 }
      );
    }

    // ─── Verification 4: Load space & check classification ──────────────────

    const [space] = await db
      .select()
      .from(spaces)
      .where(eq(spaces.id, doc.spaceId))
      .limit(1);

    if (!space) {
      return NextResponse.json(
        { error: "Not found" },
        { status: 404 }
      );
    }

    if (doc.classification !== "public" || space.classification !== "public") {
      return NextResponse.json(
        { error: "Not found" },
        { status: 404 }
      );
    }

    // ─── Verification 5: Find meeting by roomName & documentId ──────────────

    const [meeting] = await db
      .select()
      .from(meetings)
      .where(
        and(
          eq(meetings.roomName, roomName),
          eq(meetings.documentId, doc.id)
        )
      )
      .limit(1);

    if (!meeting) {
      return NextResponse.json(
        { error: "Not found" },
        { status: 404 }
      );
    }

    // ─── Verification 6: Check meeting status ───────────────────────────────

    const endedStatuses = ["ended", "completed", "failed"];
    if (endedStatuses.includes(meeting.status)) {
      return NextResponse.json(
        { error: "La réunion est terminée" },
        { status: 409 }
      );
    }

    // ─── Verification 7: Check LiveKit credentials ──────────────────────────

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      logger.error("[guest-meet-token] LiveKit credentials not configured");
      return NextResponse.json(
        { error: "Service unavailable" },
        { status: 503 }
      );
    }

    // ─── Generate LiveKit token ────────────────────────────────────────────

    try {
      const guestUserId = `guest_${randomUUID()}`;
      const token = await generateLiveKitToken({
        roomName,
        userId: guestUserId,
        userName: sanitizedDisplayName,
        userEmail: "",
        ttl: "1h",
      });

      logger.debug(
        { guestUserId, roomName, displayName: sanitizedDisplayName },
        "[guest-meet-token] Token generated successfully"
      );

      return NextResponse.json({ token }, { status: 200 });
    } catch (err) {
      logger.error(
        { err, roomName },
        "[guest-meet-token] Token generation failed"
      );
      return NextResponse.json(
        { error: "Service unavailable" },
        { status: 503 }
      );
    }
  } catch (err) {
    logger.error({ err }, "[guest-meet-token] Unexpected error");
    return NextResponse.json(
      { error: "Not found" },
      { status: 404 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-user";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { createMeeting, generateAutoTitle, listMeetings } from "@/lib/meet/rooms";
import { checkVisioPermission } from "@/lib/meet/permissions";
import { z } from "zod";

const createRoomSchema = z.object({
  title: z.string().max(255).optional(),
  spaceId: z.string().uuid(),
  documentId: z.string().uuid().optional(),
  mode: z.enum(["immediate", "scheduled"]).default("immediate"),
  type: z.enum(["video", "in_person"]).default("video"),
  scheduledAt: z.string().datetime().optional(),
  calendarId: z.string().uuid().optional(),
  attendeeUserIds: z.array(z.string().uuid()).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`meet:${ip}`, RATE_LIMITS.meet);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Trop de requêtes, réessayez plus tard" },
      { status: 429 }
    );
  }

  const body = await req.json();
  const parsed = createRoomSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { mode, spaceId, documentId } = parsed.data;
  const meetingType = parsed.data.type;

  // Check visio permission
  const action = mode === "immediate" ? "create_immediate" : "create_scheduled";
  const allowed = await checkVisioPermission(user.id, spaceId, action);
  if (!allowed) {
    return NextResponse.json(
      { error: "Permission insuffisante pour créer une réunion dans cet espace" },
      { status: 403 }
    );
  }

  // Generate auto-title if not provided
  const title = parsed.data.title?.trim() || await generateAutoTitle(spaceId, documentId);

  const meeting = await createMeeting({
    title,
    spaceId,
    documentId,
    createdBy: user.id,
    mode,
    meetingType,
    scheduledAt: parsed.data.scheduledAt,
    calendarId: parsed.data.calendarId,
    attendeeUserIds: parsed.data.attendeeUserIds,
  });

  return NextResponse.json(meeting, { status: 201 });
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const limit = Number(req.nextUrl.searchParams.get("limit")) || 20;
  const result = await listMeetings(user.id, Math.min(limit, 50));
  return NextResponse.json(result);
}

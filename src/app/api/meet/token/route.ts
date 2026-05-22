import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-user";
import { generateLiveKitToken } from "@/lib/meet/livekit-token";
import { getMeetingByRoomName, canAccessMeeting } from "@/lib/meet/rooms";
import { z } from "zod";

const tokenSchema = z.object({
  roomName: z.string().min(1).max(100),
});

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
    return NextResponse.json(
      { error: "LiveKit non configuré (clés API manquantes)" },
      { status: 503 }
    );
  }

  const body = await req.json();
  const parsed = tokenSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  // Verify the meeting exists and the user has access
  const meeting = await getMeetingByRoomName(parsed.data.roomName);
  if (!meeting) {
    return NextResponse.json({ error: "Réunion introuvable" }, { status: 404 });
  }

  const allowed = await canAccessMeeting(user.id, meeting);
  if (!allowed) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const token = await generateLiveKitToken({
    roomName: parsed.data.roomName,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
  });

  return NextResponse.json({ token });
}

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-user";
import { getMeeting, updateMeetingStatus } from "@/lib/meet/rooms";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;
  const meeting = await getMeeting(id);

  if (!meeting) {
    return NextResponse.json({ error: "Réunion introuvable" }, { status: 404 });
  }

  if (meeting.createdBy !== user.id) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  if (meeting.status !== "scheduled") {
    return NextResponse.json({ status: meeting.status });
  }

  const updated = await updateMeetingStatus(id, "active", {
    startedAt: new Date(),
  });

  return NextResponse.json({ status: updated.status });
}

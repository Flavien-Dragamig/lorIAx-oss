import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-user";
import { getMeeting, canAccessMeeting } from "@/lib/meet/rooms";

export async function GET(
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

  const allowed = await canAccessMeeting(user.id, meeting);
  if (!allowed) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  let speakers = undefined;
  if (meeting.status === "mapping" && meeting.speakerMapping) {
    const data = meeting.speakerMapping;
    if (data && "_pending" in data && data._pending && data.speakerFirstWords) {
      speakers = Object.entries(data.speakerFirstWords).map(([id, firstWords]) => ({
        id,
        firstWords,
      }));
    }
  }

  return NextResponse.json({
    id: meeting.id,
    status: meeting.status,
    notesDocumentId: meeting.notesDocumentId,
    egressId: meeting.egressId || null,
    speakers,
  });
}

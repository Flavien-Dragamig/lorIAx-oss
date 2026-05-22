import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-user";
import { getMeeting, getMeetingWithNotes, canAccessMeeting } from "@/lib/meet/rooms";

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

  const notes = await getMeetingWithNotes(id);

  if (!notes) {
    return NextResponse.json({ error: "Compte-rendu introuvable" }, { status: 404 });
  }

  return NextResponse.json(notes);
}

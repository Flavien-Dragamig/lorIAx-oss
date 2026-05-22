import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-user";
import { getMeeting, getMeetingParticipants, updateMeetingTitle, deleteMeeting, canAccessMeeting } from "@/lib/meet/rooms";
import { getSpacePermission } from "@/lib/auth/check-access";
import { hasGlobalRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { meetings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

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

  const participants = await getMeetingParticipants(id);

  return NextResponse.json({ ...meeting, participants });
}

const patchSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  participants: z.array(z.string().max(100)).max(10).optional(),
});

export async function PATCH(
  req: NextRequest,
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
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  let updated = parsed.data.title
    ? await updateMeetingTitle(id, parsed.data.title)
    : meeting;

  if (parsed.data.participants !== undefined) {
    const [withParticipants] = await db
      .update(meetings)
      .set({ participants: parsed.data.participants, updatedAt: new Date() })
      .where(eq(meetings.id, id))
      .returning();
    updated = withParticipants;
  }

  return NextResponse.json(updated);
}

export async function DELETE(
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

  // Only scheduled meetings can be deleted
  if (meeting.status !== "scheduled") {
    return NextResponse.json(
      { error: "Seules les réunions planifiées peuvent être supprimées" },
      { status: 400 }
    );
  }

  // Permission check: creator, space admin, or super_admin
  const isCreator = meeting.createdBy === user.id;
  const isSuperAdmin = hasGlobalRole(user.globalRole, "admin");
  let isSpaceAdmin = false;

  if (meeting.spaceId) {
    const perm = await getSpacePermission(user.id, meeting.spaceId);
    isSpaceAdmin = perm === "admin";
  }

  if (!isCreator && !isSuperAdmin && !isSpaceAdmin) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  await deleteMeeting(id);
  return NextResponse.json({ success: true });
}

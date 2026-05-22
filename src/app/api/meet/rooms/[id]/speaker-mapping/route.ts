import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-user";
import { getMeeting, updateMeetingStatus } from "@/lib/meet/rooms";
import { formatTranscript, type TranscriptResult } from "@/lib/meet/transcribe";
import { summarizeMeeting } from "@/lib/meet/summarize";
import { createMeetingNotes } from "@/lib/meet/meeting-notes";
import { db } from "@/lib/db";
import { meetings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import logger from "@/lib/logger";
import { z } from "zod";

const log = logger.child({ module: "meet-speaker-mapping" });

const mappingSchema = z.object({
  mapping: z.record(z.string(), z.string()),
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
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  if (meeting.status !== "mapping") {
    return NextResponse.json({ error: "La réunion n'est pas en attente de mapping" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = mappingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  await db
    .update(meetings)
    .set({ speakerMapping: parsed.data.mapping, updatedAt: new Date() })
    .where(eq(meetings.id, id));

  // Re-read meeting to get fresh speakerMapping with stored segments
  const freshMeeting = await getMeeting(id);
  resolveMappingPipeline(id, freshMeeting!, parsed.data.mapping, user.id).catch((error) => {
    log.error({ error, meetingId: id }, "Mapping pipeline failed");
  });

  return NextResponse.json({ status: "summarizing", message: "Régénération du résumé en cours" });
}

async function resolveMappingPipeline(
  meetingId: string,
  meeting: Awaited<ReturnType<typeof getMeeting>>,
  mapping: Record<string, string>,
  createdBy: string
) {
  try {
    await updateMeetingStatus(meetingId, "summarizing");

    // Read stored segments from speakerMapping (set during initial pipeline)
    const storedData = meeting?.speakerMapping;
    if (!storedData || !("_pending" in storedData) || !storedData.segments) {
      log.error({ meetingId }, "No stored segments found for mapping");
      await updateMeetingStatus(meetingId, "failed");
      return;
    }

    const segments = storedData.segments as TranscriptResult["segments"];

    const mappedSegments = segments.map((s) => ({
      ...s,
      speaker: s.speaker ? (mapping[s.speaker] || s.speaker) : s.speaker,
    }));

    const mappedResult: TranscriptResult = {
      text: segments.map((s) => s.text).join(" "),
      segments: mappedSegments,
      language: "fr",
      duration: segments[segments.length - 1]?.end || 0,
    };
    const transcriptText = formatTranscript(mappedResult);

    const summary = await summarizeMeeting(transcriptText, meeting?.title ?? "");

    if (meeting?.spaceId) {
      await createMeetingNotes({
        meetingId,
        title: meeting.title ?? "",
        spaceId: meeting.spaceId,
        createdBy,
        summary: summary || "(Aucun résumé disponible)",
        transcript: transcriptText,
      });
    }

    // Replace temporary segment data with final clean mapping
    await db
      .update(meetings)
      .set({ speakerMapping: mapping, updatedAt: new Date() })
      .where(eq(meetings.id, meetingId));

    await updateMeetingStatus(meetingId, "completed");
    log.info({ meetingId }, "Mapping pipeline completed");
  } catch (error) {
    log.error({ error, meetingId }, "Mapping pipeline error");
    await updateMeetingStatus(meetingId, "failed").catch(() => {});
  }
}

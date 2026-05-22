import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import { getSessionUser } from "@/lib/auth/get-user";
import { getMeeting, updateMeetingStatus } from "@/lib/meet/rooms";
import { stopRecording } from "@/lib/meet/egress";
import { findRecording } from "@/lib/meet/recording";
import { transcribeWithEngine, formatTranscript, isTranscriptionEnabled } from "@/lib/meet/transcribe";
import { summarizeMeeting } from "@/lib/meet/summarize";
import { createMeetingNotes } from "@/lib/meet/meeting-notes";
import { db } from "@/lib/db";
import { meetings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import logger from "@/lib/logger";

const log = logger.child({ module: "meet-end" });

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

  // Mark as ended
  await updateMeetingStatus(id, "ended", { endedAt: new Date() });

  // Launch the transcription pipeline asynchronously (non-blocking)
  runPipeline(id, meeting.roomName, meeting.title, meeting.spaceId, user.id).catch(
    (error) => {
      log.error({ error, meetingId: id }, "Pipeline failed");
    }
  );

  return NextResponse.json({ status: "ended", message: "Pipeline de transcription lancé" });
}

/**
 * Retry a function up to `maxRetries` times with exponential backoff.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  meetingId: string,
  maxRetries = 2,
  baseDelayMs = 3000,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        log.warn({ meetingId, attempt: attempt + 1, maxRetries, delay, error: String(err) }, `${label} failed, retrying in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

/**
 * Async pipeline: recording → transcription → summary → document creation.
 * Runs in background after the HTTP response is sent.
 *
 * Resilience:
 * - Retry on transcription (2 retries, backoff 3s/6s)
 * - Retry on summarization (2 retries, backoff 3s/6s)
 * - Always create the notes document, even with partial data
 * - Structured logging at each step for debugging
 */
async function runPipeline(
  meetingId: string,
  roomName: string,
  title: string,
  spaceId: string | null,
  createdBy: string
) {
  const pipelineStart = Date.now();
  log.info({ meetingId, roomName, spaceId }, "Pipeline started");

  try {
    // Step 0: Wait for egressId if recording is still initializing (race condition guard)
    let meeting = await getMeeting(meetingId);
    if (!meeting?.egressId) {
      for (let i = 0; i < 10 && !meeting?.egressId; i++) {
        await new Promise((r) => setTimeout(r, 500));
        meeting = await getMeeting(meetingId);
      }
    }

    // Stop Egress recording if active
    if (meeting?.egressId) {
      log.info({ meetingId, egressId: meeting.egressId }, "Stopping Egress recording");
      try {
        await stopRecording(meeting.egressId);
      } catch (err) {
        log.warn({ meetingId, error: String(err) }, "Failed to stop Egress — continuing pipeline");
      }
    } else {
      log.warn({ meetingId }, "No egressId — recording may not have been started");
    }

    // Step 1: Find recording (retry to handle Egress file finalization delay)
    let recordingPath = await findRecording(roomName);
    if (!recordingPath && meeting?.egressId) {
      log.info({ meetingId }, "Recording not found yet — waiting for Egress finalization");
      for (let i = 0; i < 5 && !recordingPath; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        recordingPath = await findRecording(roomName);
      }
    }

    let transcriptText = "";
    let summary = "";

    if (!recordingPath) {
      log.warn({ meetingId, roomName }, "No recording found — creating notes without transcript");
    } else {
      const { stat } = await import("fs/promises");
      const fileSize = await stat(recordingPath).then(s => s.size).catch(() => -1);
      log.info({ meetingId, recordingPath, fileSize }, "Recording found — starting transcription pipeline");
      await updateMeetingStatus(meetingId, "transcribing", { recordingPath });

      // Step 2: Transcribe with retry
      const transcriptionEnabled = await isTranscriptionEnabled();

      if (!transcriptionEnabled) {
        log.warn({ meetingId }, "No transcription engine available — skipping transcription");
      } else {
        try {
          const t0 = Date.now();
          const transcriptResult = await withRetry(
            () => transcribeWithEngine(recordingPath!),
            "Transcription",
            meetingId,
          );
          transcriptText = formatTranscript(transcriptResult);
          log.info({ meetingId, segments: transcriptResult.segments.length, textLength: transcriptText.length, latencyMs: Date.now() - t0 }, "Transcription succeeded");

          // For in-person meetings: pause at 'mapping' status for speaker association
          const currentMeeting = await getMeeting(meetingId);
          if (currentMeeting?.meetingType === "in_person" && transcriptResult.segments.some(s => s.speaker)) {
            const speakerFirstWords: Record<string, string> = {};
            for (const seg of transcriptResult.segments) {
              if (seg.speaker && !speakerFirstWords[seg.speaker]) {
                speakerFirstWords[seg.speaker] = seg.text.trim().slice(0, 60);
              }
            }

            await db
              .update(meetings)
              .set({
                speakerMapping: {
                  _pending: true,
                  segments: transcriptResult.segments,
                  speakerFirstWords,
                },
                updatedAt: new Date(),
              })
              .where(eq(meetings.id, meetingId));

            await updateMeetingStatus(meetingId, "mapping");
            log.info({ meetingId, speakers: Object.keys(speakerFirstWords) }, "Waiting for speaker mapping");
            return;
          }
        } catch (err) {
          log.error({ error: String(err), stack: (err as Error).stack?.split("\n").slice(0, 3).join(" | "), meetingId }, "Transcription failed after all retries");
        }
      }

      if (transcriptText) {
        await updateMeetingStatus(meetingId, "summarizing");

        // Step 3: Summarize with retry
        try {
          const t0 = Date.now();
          summary = await withRetry(
            () => summarizeMeeting(transcriptText, title),
            "Summarization",
            meetingId,
          );
          log.info({ meetingId, summaryLength: summary.length, latencyMs: Date.now() - t0 }, "Summarization succeeded");
        } catch (err) {
          log.error({ error: String(err), stack: (err as Error).stack?.split("\n").slice(0, 3).join(" | "), meetingId }, "Summarization failed after all retries");
        }
      }
    }

    // Step 4: Always create the notes document (even with partial data)
    if (spaceId) {
      try {
        await createMeetingNotes({
          meetingId,
          title,
          spaceId,
          createdBy,
          summary: summary || "(Aucun résumé disponible — pas d'enregistrement audio ou transcription échouée)",
          transcript: transcriptText || "(Aucun transcript — pas d'enregistrement audio capté)",
        });
        log.info({ meetingId }, "Meeting notes document created");
      } catch (err) {
        log.error({ error: String(err), meetingId }, "Failed to create meeting notes document");
      }
    }

    await updateMeetingStatus(meetingId, "completed");
    log.info({ meetingId, hasRecording: !!recordingPath, hasTranscript: !!transcriptText, hasSummary: !!summary, totalLatencyMs: Date.now() - pipelineStart }, "Pipeline completed");

    // Step 5: Purge audio file after successful transcription
    if (recordingPath && transcriptText) {
      try {
        await unlink(recordingPath);
        log.info({ meetingId, recordingPath }, "Recording file purged after successful transcription");
      } catch (purgeErr) {
        log.warn({ error: String(purgeErr), recordingPath }, "Failed to purge recording file — not critical");
      }
    }
  } catch (error) {
    log.error({ error: String(error), stack: (error as Error).stack?.split("\n").slice(0, 5).join(" | "), meetingId, totalLatencyMs: Date.now() - pipelineStart }, "Pipeline error — unrecoverable");
    await updateMeetingStatus(meetingId, "failed").catch(() => {});
  }
}

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Mic, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MeetingToolbar } from "./shared/meeting-toolbar";
import { MeetingStatusSection } from "./shared/meeting-status-section";
import { MeetingNotesPreview } from "./shared/meeting-notes-preview";
import { ParticipantChips } from "./participant-chips";
import { VuMeter } from "./vu-meter";
import { SpeakerMapping } from "./speaker-mapping";
import { LiveKitHeadless } from "./livekit-headless";

export function InPersonMeetingBlockView({
  node,
  updateAttributes,
  deleteNode,
  selected,
  editor,
}: NodeViewProps) {
  const { meetingId, title, status, roomName, notesDocumentId, spaceId: _spaceId, participants, speakerMapping: _speakerMapping } = node.attrs;
  const isEditable = editor.isEditable;
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [speakers, setSpeakers] = useState<Array<{ id: string; firstWords: string }>>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // Create meeting on first render
  useEffect(() => {
    if (meetingId || !isEditable) return;
    const sid = typeof window !== "undefined" ? window.__loriax_spaceId ?? "" : "";
    const docId = typeof window !== "undefined" ? window.__loriax_docId ?? undefined : undefined;
    if (!sid) return;
    setLoading(true);
    fetch("/api/meet/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spaceId: sid, documentId: docId, mode: "immediate", type: "in_person" }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((meeting) => {
        if (meeting) {
          updateAttributes({
            meetingId: meeting.id,
            title: meeting.title,
            roomName: meeting.roomName,
            status: meeting.status,
            spaceId: sid,
          });
        }
      })
      .finally(() => setLoading(false));
  }, [meetingId, isEditable, updateAttributes]);

  // Poll status
  useEffect(() => {
    if (!meetingId || !["active", "ended", "transcribing", "mapping", "summarizing"].includes(status)) return;
    const delay = status === "active" ? 10000 : 5000;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/meet/rooms/${meetingId}/status`);
        if (res.ok) {
          const data = await res.json();
          if (data.status !== status) {
            updateAttributes({
              status: data.status,
              notesDocumentId: data.notesDocumentId || null,
            });
          }
          if (data.status === "mapping" && data.speakers) {
            setSpeakers(data.speakers);
          }
          if (["completed", "failed"].includes(data.status)) clearInterval(interval);
        }
      } catch { /* ignore */ }
    }, delay);
    return () => clearInterval(interval);
  }, [meetingId, status, updateAttributes]);

  // Timer for active recording
  useEffect(() => {
    if (status !== "active") {
      clearInterval(timerRef.current);
      return;
    }
    startTimeRef.current = Date.now() - elapsed * 1000;
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [status]);

  // Callbacks for LiveKitHeadless (stable refs to avoid re-renders)
  const handleLiveKitStream = useCallback((stream: MediaStream | null) => {
    setAudioStream(stream);
  }, []);

  const handleLiveKitError = useCallback((message: string) => {
    setMicError(message);
    updateAttributes({ status: "scheduled" });
    setBusy(false);
  }, [updateAttributes]);

  const handleStart = useCallback(async () => {
    if (!roomName || busy) return;
    setBusy(true);
    setMicError(null);
    // Transition to active — LiveKitHeadless will mount and connect
    updateAttributes({ status: "active" });
    setElapsed(0);
    startTimeRef.current = Date.now();
    setBusy(false);
  }, [roomName, busy, updateAttributes]);

  const handleStop = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    // LiveKitHeadless will disconnect automatically when status changes (unmount)
    if (meetingId) {
      try {
        await fetch(`/api/meet/rooms/${meetingId}/end`, { method: "POST" });
        updateAttributes({ status: "ended" });
      } catch { /* ignore */ }
    }
    setAudioStream(null);
    setBusy(false);
  }, [meetingId, busy, updateAttributes]);

  const handleParticipantsChange = useCallback(
    (newParticipants: string[]) => {
      updateAttributes({ participants: newParticipants });
      if (meetingId) {
        fetch(`/api/meet/rooms/${meetingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ participants: newParticipants }),
        }).catch(() => {});
      }
    },
    [meetingId, updateAttributes]
  );

  const handleTitleChange = useCallback(
    async (newTitle: string) => {
      updateAttributes({ title: newTitle });
      if (meetingId) {
        try {
          await fetch(`/api/meet/rooms/${meetingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: newTitle }),
          });
        } catch { /* ignore */ }
      }
    },
    [meetingId, updateAttributes]
  );

  const handleDelete = useCallback(async () => {
    // LiveKitHeadless disconnects on unmount; no manual stream cleanup needed
    if (meetingId && status === "scheduled") {
      try { await fetch(`/api/meet/rooms/${meetingId}`, { method: "DELETE" }); } catch { /* ignore */ }
    }
    deleteNode();
  }, [meetingId, status, deleteNode]);

  const handleMappingValidate = useCallback(
    async (mapping: Record<string, string>) => {
      updateAttributes({ speakerMapping: mapping, status: "summarizing" });
      if (meetingId) {
        try {
          await fetch(`/api/meet/rooms/${meetingId}/speaker-mapping`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mapping }),
          });
        } catch { /* ignore */ }
      }
    },
    [meetingId, updateAttributes]
  );

  const handleMappingSkip = useCallback(async () => {
    const defaultMapping: Record<string, string> = {};
    speakers.forEach((s, i) => {
      defaultMapping[s.id] = (participants as string[])[i] || s.id;
    });
    await handleMappingValidate(defaultMapping);
  }, [speakers, participants, handleMappingValidate]);

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <NodeViewWrapper>
        <div className="flex items-center justify-center rounded-lg border border-border/50 bg-card p-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Création de la réunion...</span>
        </div>
      </NodeViewWrapper>
    );
  }

  let actions = null;
  let extraContent = null;

  if (status === "scheduled") {
    actions = (
      <Button size="sm" onClick={handleStart} disabled={!roomName || busy}>
        <Mic className="h-4 w-4 mr-1" />
        Démarrer
      </Button>
    );
    extraContent = (
      <>
        {micError && (
          <div className="flex items-center gap-1 text-xs text-destructive mt-2">
            <AlertCircle className="h-3.5 w-3.5" />
            {micError}
          </div>
        )}
        <ParticipantChips
          participants={participants || []}
          onChange={handleParticipantsChange}
          readOnly={false}
        />
      </>
    );
  } else if (status === "active") {
    actions = (
      <div className="flex flex-col items-start gap-1">
        <span className="in-person-recording-badge">
          <span className="in-person-recording-dot" />
          Enregistrement
        </span>
        <span className="text-xs text-muted-foreground">{formatTime(elapsed)}</span>
        <button onClick={handleStop} className="in-person-stop-btn mt-0.5">
          ■ Arrêter
        </button>
      </div>
    );
    extraContent = (
      <>
        <LiveKitHeadless
          roomName={roomName}
          meetingId={meetingId}
          onStream={handleLiveKitStream}
          onError={handleLiveKitError}
        />
        <VuMeter stream={audioStream} />
        <ParticipantChips participants={participants || []} onChange={() => {}} readOnly />
      </>
    );
  } else if (status === "transcribing" || status === "summarizing") {
    actions = (
      <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        {status === "transcribing" ? "Transcription en cours..." : "Génération du résumé..."}
      </div>
    );
  } else if (status === "completed") {
    actions = (
      <MeetingNotesPreview meetingId={meetingId} notesDocumentId={notesDocumentId} status={status} />
    );
  } else if (status === "failed") {
    actions = (
      <div className="flex items-center gap-1 text-xs text-destructive">
        <AlertCircle className="h-4 w-4" />
        Erreur de transcription
      </div>
    );
  }

  const iconBg =
    status === "active"
      ? "bg-red-500/10"
      : status === "completed"
        ? "bg-green-500/10"
        : "bg-violet-500/10";

  return (
    <NodeViewWrapper className={`meeting-block-wrapper my-4 ${selected ? "is-selected" : ""}`}>
      <div className="meeting-block rounded-lg border border-border/50 bg-card overflow-hidden">
        <MeetingToolbar
          title={title}
          isEditable={isEditable}
          isSelected={!!selected}
          onTitleChange={handleTitleChange}
          onDelete={handleDelete}
        />
        <MeetingStatusSection
          icon={<Mic className="h-5 w-5 text-violet-500" />}
          iconBgClass={iconBg}
          status={status || "scheduled"}
          actions={actions}
        />
        {extraContent && <div className="px-4 pb-4">{extraContent}</div>}
        {status === "mapping" && speakers.length > 0 && (
          <SpeakerMapping
            speakers={speakers}
            participants={participants || []}
            onValidate={handleMappingValidate}
            onSkip={handleMappingSkip}
          />
        )}
      </div>
    </NodeViewWrapper>
  );
}

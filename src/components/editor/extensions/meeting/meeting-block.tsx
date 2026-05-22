"use client";

import { useEffect, useState, useCallback } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Video, ExternalLink, Loader2, AlertCircle, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MeetingToolbar } from "./shared/meeting-toolbar";
import { MeetingNotesPreview } from "./shared/meeting-notes-preview";
import { MeetingStatusSection } from "./shared/meeting-status-section";

export function MeetingBlockView({
  node,
  updateAttributes,
  deleteNode,
  selected,
  editor,
}: NodeViewProps) {
  const { meetingId, title, status, roomName, notesDocumentId } = node.attrs;
  const isEditable = editor.isEditable;
  const [loading, setLoading] = useState(false);

  // Create meeting on first render if no meetingId
  useEffect(() => {
    if (meetingId || !isEditable) return;
    const spaceId = typeof window !== "undefined" ? window.__loriax_spaceId ?? "" : "";
    const docId = typeof window !== "undefined" ? window.__loriax_docId ?? undefined : undefined;
    if (!spaceId) return;
    setLoading(true);
    fetch("/api/meet/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spaceId, documentId: docId, mode: "immediate" }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((meeting) => {
        if (meeting) {
          updateAttributes({
            meetingId: meeting.id,
            title: meeting.title,
            roomName: meeting.roomName,
            status: meeting.status,
            spaceId,
          });
        }
      })
      .finally(() => setLoading(false));
  }, [meetingId, title, isEditable, updateAttributes]);

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
            updateAttributes({ status: data.status, notesDocumentId: data.notesDocumentId || null });
          }
          if (data.status === "completed" || data.status === "failed") clearInterval(interval);
        }
      } catch { /* ignore */ }
    }, delay);
    return () => clearInterval(interval);
  }, [meetingId, status, updateAttributes]);

  const handleTitleChange = useCallback(async (newTitle: string) => {
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
  }, [meetingId, updateAttributes]);

  const handleDelete = useCallback(async () => {
    if (meetingId && status === "scheduled") {
      try { await fetch(`/api/meet/rooms/${meetingId}`, { method: "DELETE" }); } catch { /* ignore */ }
    }
    deleteNode();
  }, [meetingId, status, deleteNode]);

  const handleJoin = useCallback(() => {
    if (roomName) {
      window.open(`/meet/${roomName}`, "_blank", "noopener");
      updateAttributes({ status: "active" });
    }
  }, [roomName, updateAttributes]);

  if (loading) {
    return (
      <NodeViewWrapper>
        <div className="flex items-center justify-center rounded-lg border border-border/50 bg-card p-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Création de la salle...</span>
        </div>
      </NodeViewWrapper>
    );
  }

  const actions = (
    <>
      {(status === "scheduled" || status === "active") && roomName && (
        <>
          <Button size="sm" onClick={handleJoin}>
            <ExternalLink className="h-4 w-4 mr-1" />
            {status === "active" ? "Rejoindre" : "Démarrer"}
          </Button>
          {status === "scheduled" && isEditable && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const pos = editor.state.selection.from;
                editor
                  .chain()
                  .focus()
                  .insertContentAt(pos, {
                    type: "inPersonMeetingBlock",
                    attrs: { meetingId: "", title, status: "scheduled", participants: [] },
                  })
                  .run();
                deleteNode();
              }}
              title="Passer en mode réunion présentielle"
              aria-label="Passer en mode réunion présentielle"
            >
              <Mic className="h-4 w-4" />
            </Button>
          )}
        </>
      )}
      {(status === "transcribing" || status === "summarizing") && (
        <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          {status === "transcribing" ? "Transcription en cours..." : "Génération du résumé..."}
        </div>
      )}
      {status === "completed" && (
        <MeetingNotesPreview meetingId={meetingId} notesDocumentId={notesDocumentId} status={status} />
      )}
      {status === "failed" && (
        <div className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-4 w-4" />
          Erreur de transcription
        </div>
      )}
    </>
  );

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
          icon={<Video className="h-5 w-5 text-primary" />}
          iconBgClass="bg-primary/10"
          status={status || "scheduled"}
          actions={actions}
        />
      </div>
    </NodeViewWrapper>
  );
}

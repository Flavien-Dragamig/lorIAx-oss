"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, PhoneOff, Pencil, Check } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LiveKitMeeting } from "@/components/meet/livekit-room";
import { useCurrentUser } from "@/hooks/use-session";

export default function MeetRoomPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const roomName = params.roomName as string;
  const audioOnly = searchParams.get("audioOnly") === "true";
  const user = useCurrentUser();
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [title, setTitle] = useState<string>("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [ending, setEnding] = useState(false);
  const [returnUrl, setReturnUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch meeting for this room and activate it
  useEffect(() => {
    fetch("/api/meet/rooms")
      .then((res) => res.json())
      .then((meetings: Array<{ id: string; roomName: string; title: string; status: string; documentId?: string | null; spaceSlug?: string | null }>) => {
        const found = meetings.find((m) => m.roomName === roomName);
        if (found) {
          setMeetingId(found.id);
          setTitle(found.title);
          // URL de retour vers le document source si la réunion a été lancée depuis un document
          if (found.documentId && found.spaceSlug) {
            setReturnUrl(`/s/${found.spaceSlug}/${found.documentId}`);
          }
          // Activer la réunion si elle est encore au statut « scheduled »
          if (found.status === "scheduled") {
            fetch(`/api/meet/rooms/${found.id}/activate`, { method: "POST" }).catch(() => {});
          }
        }
      })
      .catch(() => {});
  }, [roomName]);

  const handleStartEditing = useCallback(() => {
    setEditValue(title);
    setEditingTitle(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [title]);

  const handleSaveTitle = useCallback(async () => {
    const trimmed = editValue.trim();
    if (!trimmed || !meetingId || trimmed === title) {
      setEditingTitle(false);
      return;
    }

    try {
      const res = await fetch(`/api/meet/rooms/${meetingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTitle(updated.title);
        toast.success("Titre mis à jour");
      } else {
        toast.error("Erreur lors du renommage");
      }
    } catch {
      toast.error("Erreur réseau");
    }
    setEditingTitle(false);
  }, [editValue, meetingId, title]);

  const handleEndMeeting = useCallback(async () => {
    if (!meetingId) return;
    setEnding(true);
    try {
      const res = await fetch(`/api/meet/rooms/${meetingId}/end`, { method: "POST" });
      if (res.ok) {
        toast.success("Réunion terminée — transcription en cours");
      } else {
        toast.error("Erreur lors de la fermeture");
      }
      router.push(returnUrl || "/meet");
    } finally {
      setEnding(false);
    }
  }, [meetingId, router, returnUrl]);

  const handleReadyToClose = useCallback(() => {
    if (meetingId) {
      handleEndMeeting();
    } else {
      router.push(returnUrl || "/meet");
    }
  }, [meetingId, handleEndMeeting, router, returnUrl]);

  if (!user) return null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-3">
          <Link
            href={returnUrl || "/meet"}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {returnUrl ? "Retour au document" : "Retour"}
          </Link>

          {editingTitle ? (
            <div className="flex items-center gap-1">
              <Input
                ref={inputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTitle();
                  if (e.key === "Escape") setEditingTitle(false);
                }}
                className="h-7 w-64 text-sm"
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={handleSaveTitle}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <button
              onClick={handleStartEditing}
              className="flex items-center gap-1.5 text-sm font-medium hover:text-primary transition-colors group"
            >
              <span className="truncate max-w-[150px] md:max-w-none">{title || roomName}</span>
              <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          )}
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleEndMeeting}
          disabled={ending || !meetingId}
        >
          <PhoneOff className="h-4 w-4 md:mr-2" />
          <span className="hidden md:inline">{ending ? "Fermeture..." : "Terminer la réunion"}</span>
        </Button>
      </div>

      <div className="flex-1 min-h-0 p-4">
        <LiveKitMeeting
          roomName={roomName}
          userName={user.name}
          userEmail={user.email}
          meetingId={meetingId}
          onDisconnected={handleReadyToClose}
          audioOnly={audioOnly}
          height="100%"
        />
      </div>
    </div>
  );
}

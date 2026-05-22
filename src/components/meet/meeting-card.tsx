"use client";

import Link from "next/link";
import { Video, FileText, Clock, Trash2, CalendarClock } from "lucide-react";
import { MeetingStatusBadge } from "./meeting-status-badge";
import { Button } from "@/components/ui/button";

interface Meeting {
  id: string;
  title: string;
  roomName: string;
  status: string;
  spaceId?: string | null;
  notesDocumentId?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  createdAt: string;
  scheduledAt?: string | null;
}

interface MeetingCardProps {
  meeting: Meeting;
  canDelete?: boolean;
  notesUrl?: string | null;
  onDelete?: (id: string) => void;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  if (hours < 24) return `Il y a ${hours}h`;
  if (days < 7) return `Il y a ${days}j`;
  return date.toLocaleDateString("fr-FR");
}

export function MeetingCard({ meeting, canDelete, notesUrl, onDelete }: MeetingCardProps) {
  const isActive = meeting.status === "active";
  const isProcessing =
    meeting.status === "transcribing" || meeting.status === "summarizing";

  return (
    <div className="flex items-center justify-between rounded-lg border border-border/50 bg-card p-4 transition-colors hover:bg-accent/5">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Video className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium">{meeting.title}</h3>
          <div className="flex items-center gap-2 mt-1">
            <MeetingStatusBadge status={meeting.status} />
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {meeting.scheduledAt ? (
                <>
                  <CalendarClock className="h-3 w-3" />
                  {new Date(meeting.scheduledAt).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </>
              ) : (
                <>
                  <Clock className="h-3 w-3" />
                  {formatRelativeTime(meeting.startedAt || meeting.createdAt)}
                </>
              )}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-4">
        {meeting.status === "scheduled" && canDelete && onDelete && (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              if (confirm("Supprimer cette réunion planifiée ?")) {
                onDelete(meeting.id);
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
        {isActive && (
          <Link href={`/meet/${meeting.roomName}`}>
            <Button size="sm" variant="default">
              Rejoindre
            </Button>
          </Link>
        )}
        {isProcessing && (
          <span className="text-xs text-muted-foreground animate-pulse">
            Traitement en cours...
          </span>
        )}
        {meeting.status === "completed" && meeting.notesDocumentId && notesUrl && (
          <Link href={notesUrl} title="Voir le compte-rendu">
            <Button size="sm" variant="outline">
              <FileText className="h-4 w-4 mr-1" />
              Compte-rendu
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

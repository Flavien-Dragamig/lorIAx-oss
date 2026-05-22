"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Video, Plus, VideoOff, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MeetingCard } from "@/components/meet/meeting-card";
import { useCalendars } from "@/hooks/use-calendar";
import dynamic from "next/dynamic";
import type { EventFormData } from "@/components/calendar/event-form-dialog";

const EventFormDialog = dynamic(
  () => import("@/components/calendar/event-form-dialog"),
  { ssr: false }
);

interface Meeting {
  id: string;
  title: string;
  roomName: string;
  status: string;
  spaceId?: string | null;
  spaceSlug?: string | null;
  documentId?: string | null;
  notesDocumentId?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  createdAt: string;
  scheduledAt?: string | null;
}

export default function MeetPage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [meetEnabled, setMeetEnabled] = useState(true);
  const [personalSpaceId, setPersonalSpaceId] = useState<string | null>(null);
  const [notesUrls, setNotesUrls] = useState<Record<string, string>>({});
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const { calendars } = useCalendars();

  const fetchMeetings = useCallback(async () => {
    try {
      const [roomsRes, configRes, spacesRes] = await Promise.all([
        fetch("/api/meet/rooms?limit=30"),
        fetch("/api/meet/config"),
        fetch("/api/spaces"),
      ]);
      if (roomsRes.ok) {
        setMeetings(await roomsRes.json());
      }
      if (configRes.ok) {
        const config = await configRes.json();
        setMeetEnabled(config.enabled !== false);
      }
      if (spacesRes.ok) {
        const allSpaces = await spacesRes.json();
        const personal = allSpaces.find((s: { type: string; id: string }) => s.type === "personal");
        if (personal) setPersonalSpaceId(personal.id);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  // Poll meetings that are active or processing to detect status changes
  useEffect(() => {
    const hasActiveOrProcessing = meetings.some(
      (m) =>
        m.status === "active" ||
        m.status === "ended" ||
        m.status === "transcribing" ||
        m.status === "summarizing"
    );
    if (!hasActiveOrProcessing) return;

    const interval = setInterval(() => {
      fetchMeetings();
    }, 10000);

    return () => clearInterval(interval);
  }, [meetings, fetchMeetings]);

  const handleDeleteMeeting = useCallback(async (meetingId: string) => {
    try {
      const res = await fetch(`/api/meet/rooms/${meetingId}`, { method: "DELETE" });
      if (res.ok) {
        setMeetings((prev) => prev.filter((m) => m.id !== meetingId));
        toast.success("Réunion supprimée");
      } else {
        toast.error("Erreur lors de la suppression");
      }
    } catch {
      toast.error("Erreur réseau");
    }
  }, []);

  useEffect(() => {
    const completedWithNotes = meetings.filter(
      (m) => m.status === "completed" && m.notesDocumentId
    );

    completedWithNotes.forEach(async (m) => {
      if (notesUrls[m.id]) return;
      // Use spaceSlug from the list response if available
      if (m.spaceSlug && m.notesDocumentId) {
        setNotesUrls((prev) => ({
          ...prev,
          [m.id]: `/s/${m.spaceSlug}/${m.notesDocumentId}`,
        }));
        return;
      }
      try {
        const res = await fetch(`/api/meet/rooms/${m.id}/notes`);
        if (res.ok) {
          const data = await res.json();
          setNotesUrls((prev) => ({
            ...prev,
            [m.id]: `/s/${data.spaceSlug}/${data.documentId}`,
          }));
        }
      } catch {
        // Ignore
      }
    });
  }, [meetings, notesUrls]);

  const handleCreateMeeting = async () => {
    if (!personalSpaceId) return;
    setCreating(true);
    try {
      const res = await fetch("/api/meet/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spaceId: personalSpaceId,
          mode: "immediate",
        }),
      });

      if (res.ok) {
        const meeting = await res.json();
        toast.success("Réunion créée");
        router.push(`/meet/${meeting.roomName}`);
      } else {
        toast.error("Erreur lors de la création de la réunion");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setCreating(false);
    }
  };

  const handleScheduleMeeting = async (data: EventFormData) => {
    if (!personalSpaceId) return;

    const res = await fetch("/api/meet/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: data.title,
        spaceId: personalSpaceId,
        mode: "scheduled",
        scheduledAt: new Date(data.startAt).toISOString(),
        calendarId: data.calendarId,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Erreur lors de la planification");
    }

    toast.success("Réunion planifiée");
    fetchMeetings();
  };

  const activeMeetings = meetings.filter((m) => m.status === "active");
  const processingMeetings = meetings.filter(
    (m) => m.status === "transcribing" || m.status === "summarizing"
  );
  const scheduledMeetings = meetings.filter((m) => m.status === "scheduled" && m.scheduledAt);
  const pastMeetings = meetings.filter(
    (m) =>
      m.status === "completed" ||
      m.status === "ended" ||
      m.status === "failed" ||
      (m.status === "scheduled" && !m.scheduledAt)
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Video className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Réunions</h1>
            <p className="text-sm text-muted-foreground">
              Visioconférence et comptes-rendus automatiques
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPlanDialogOpen(true)}
            disabled={!meetEnabled || !personalSpaceId}
          >
            <CalendarClock className="h-4 w-4 mr-2" />
            Planifier
          </Button>
          <Button onClick={handleCreateMeeting} disabled={creating || !meetEnabled || !personalSpaceId}>
            <Plus className="h-4 w-4 mr-2" />
            {creating ? "Création..." : "Nouvelle réunion"}
          </Button>
        </div>
      </div>

      {!loading && !meetEnabled ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/50 py-16">
          <VideoOff className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground mb-2">
            La visioconférence est désactivée
          </p>
          <p className="text-sm text-muted-foreground">
            Contactez un administrateur pour activer cette fonctionnalité.
          </p>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-lg bg-muted/50"
            />
          ))}
        </div>
      ) : meetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/50 py-16">
          <Video className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground mb-4">
            Aucune réunion pour le moment
          </p>
          <Button onClick={handleCreateMeeting} disabled={creating}>
            <Plus className="h-4 w-4 mr-2" />
            Lancer une réunion
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {scheduledMeetings.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Planifiées
              </h2>
              <div className="space-y-2">
                {scheduledMeetings.map((m) => (
                  <MeetingCard
                    key={m.id}
                    meeting={m}
                    canDelete
                    notesUrl={null}
                    onDelete={handleDeleteMeeting}
                  />
                ))}
              </div>
            </section>
          )}

          {activeMeetings.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
                En cours
              </h2>
              <div className="space-y-2">
                {activeMeetings.map((m) => (
                  <MeetingCard
                    key={m.id}
                    meeting={m}
                    canDelete={m.status === "scheduled"}
                    notesUrl={notesUrls[m.id] || null}
                    onDelete={handleDeleteMeeting}
                  />
                ))}
              </div>
            </section>
          )}

          {processingMeetings.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
                En traitement
              </h2>
              <div className="space-y-2">
                {processingMeetings.map((m) => (
                  <MeetingCard
                    key={m.id}
                    meeting={m}
                    canDelete={m.status === "scheduled"}
                    notesUrl={notesUrls[m.id] || null}
                    onDelete={handleDeleteMeeting}
                  />
                ))}
              </div>
            </section>
          )}

          {pastMeetings.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Récentes
              </h2>
              <div className="space-y-2">
                {pastMeetings.map((m) => (
                  <MeetingCard
                    key={m.id}
                    meeting={m}
                    canDelete={m.status === "scheduled"}
                    notesUrl={notesUrls[m.id] || null}
                    onDelete={handleDeleteMeeting}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {planDialogOpen && (
        <EventFormDialog
          open={planDialogOpen}
          onClose={() => setPlanDialogOpen(false)}
          onSave={handleScheduleMeeting}
          calendars={calendars}
          defaultMeeting
          spaceId={personalSpaceId || undefined}
        />
      )}
    </div>
  );
}

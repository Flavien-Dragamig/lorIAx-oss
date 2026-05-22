"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Video, Clock } from "lucide-react";

interface Meeting {
  id: string;
  title: string;
  status: string;
  roomName: string;
}

interface PublicDocument {
  title: string;
  content: string;
  icon: string | null;
  spaceName: string;
  createdAt: string;
  updatedAt: string;
  meetings?: Meeting[];
}

interface MeetingCardProps {
  meeting: Meeting;
  shareToken: string;
}

function MeetingCard({ meeting, shareToken }: MeetingCardProps) {
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [showDialog, setShowDialog] = useState(false);

  const handleJoin = () => {
    if (!displayNameInput.trim()) return;
    const url = `/public/meet/${meeting.roomName}?shareToken=${shareToken}&displayName=${encodeURIComponent(
      displayNameInput
    )}`;
    window.open(url, "_blank", "noopener");
    setShowDialog(false);
    setDisplayNameInput("");
  };

  const isActive = meeting.status === "active";

  return (
    <div className="border rounded-lg p-4 bg-card shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Video className="h-4 w-4 text-primary" />
            {meeting.title}
          </h3>
          {isActive ? (
            <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-600" />
              Réunion en cours
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
              <Clock className="h-4 w-4" />
              La réunion n&apos;a pas encore commencé
            </p>
          )}
        </div>
        {isActive && (
          <Button onClick={() => setShowDialog(true)} size="sm">
            Rejoindre
          </Button>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejoindre la réunion</DialogTitle>
            <DialogDescription>
              Veuillez entrer votre nom pour rejoindre la visioconférence.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <input
              type="text"
              maxLength={50}
              placeholder="Votre nom"
              value={displayNameInput}
              onChange={(e) => setDisplayNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && displayNameInput.trim()) {
                  handleJoin();
                }
              }}
              className="w-full px-3 py-2 border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowDialog(false)}
              >
                Annuler
              </Button>
              <Button
                onClick={handleJoin}
                disabled={!displayNameInput.trim()}
              >
                Rejoindre
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PublicDocumentPage() {
  const { token } = useParams<{ token: string }>();
  const [doc, setDoc] = useState<PublicDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchDocument() {
      try {
        const res = await fetch(`/api/public/${token}`);
        if (!res.ok) {
          setError(true);
          return;
        }
        const data = await res.json();
        setDoc(data);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchDocument();
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">404</h1>
          <p className="mt-2 text-muted-foreground">
            Document introuvable ou lien expir&eacute;
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      {/* Header */}
      <header className="mb-8 flex items-center gap-3">
        <Image src="/mascotte.svg" alt="LorIAx" width={36} height={36} />
        <span className="text-lg font-semibold text-foreground">LorIAx</span>
      </header>

      {/* Subtitle */}
      <p className="mb-6 text-sm text-muted-foreground">
        Document partag&eacute; par {doc.spaceName}
      </p>

      {/* Document title */}
      <h1 className="mb-8 text-3xl font-bold text-foreground">
        {doc.icon && <span className="mr-2">{doc.icon}</span>}
        {doc.title}
      </h1>

      {/* Content (markdown rendu en texte préformaté) */}
      <div className="prose prose-neutral dark:prose-invert max-w-none whitespace-pre-wrap">
        {doc.content}
      </div>

      {/* Meetings Section */}
      {doc.meetings && doc.meetings.length > 0 && (
        <div className="mt-8 space-y-4 border-t pt-8">
          <h2 className="text-2xl font-bold text-foreground">Réunions associées</h2>
          <div className="space-y-3">
            {doc.meetings.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                shareToken={token}
              />
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-12 border-t pt-6">
        <p className="text-xs text-muted-foreground">
          Ce document est en lecture seule
        </p>
      </footer>
    </div>
  );
}
